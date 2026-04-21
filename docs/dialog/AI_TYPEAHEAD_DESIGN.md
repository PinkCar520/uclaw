# Feature Design Document: AI-Assisted Prompt Typeahead (Ghost Text)

## 1. Executive Summary
This document outlines the product requirements, interaction design, and technical architecture for the **AI-Assisted Prompt Typeahead (Ghost Text)** feature within the uClaw `ChatInput` component. 

Inspired by industry leaders like GitHub Copilot, Cursor, and Claude, this feature aims to lower the barrier to entry for prompt engineering by silently predicting and suggesting high-quality, context-aware prompt completions as the user types.

**Goal:** Transform brief, vague user inputs (e.g., "Review this contract") into robust, expert-level prompts (e.g., "Review this contract, focusing specifically on intellectual property indemnification and governing law in California.") with a single keystroke.

---

## 2. Interaction Design (IxD)

### 2.1 Visual Presentation
- **Ghost Text Rendering**: Suggested completions will appear directly inline within the input area, positioned immediately after the user's cursor.
- **Styling**: The ghost text will be styled with a low-contrast color (e.g., `text-[#A8A4A1]/50` or `text-slate-400`) to clearly distinguish it from user-authored text. It must be non-selectable (`user-select: none`).
- **Hint Badge**: A subtle, kinetic badge (e.g., `[Tab] to complete`) will fade in at the bottom-right corner of the input box when a suggestion is active, reinforcing the interaction model.

### 2.2 User Flow & Mechanics
1. **Trigger (Silent)**: The user types in the `ChatInput` and pauses for a defined threshold (e.g., 400ms-600ms).
2. **Fetch**: The system silently dispatches a request to a low-latency AI model.
3. **Display**: If a high-confidence completion is generated, it renders as Ghost Text.
4. **Acceptance (`Tab`)**: 
   - If the user presses `Tab` while Ghost Text is visible, the suggestion is instantly appended to the actual input value, converting to standard text styling.
   - The cursor moves to the end of the newly appended text.
5. **Rejection / Dismissal**:
   - Any substantive keystroke (letters, numbers, backspace, space, Enter) immediately dismisses the current Ghost Text.
   - Moving the cursor (arrow keys or mouse click) immediately dismisses the Ghost Text.
   - Modifier keys (Shift, Ctrl, Alt, Cmd) do *not* dismiss the text.

---

## 3. Technical Architecture & Component Design

Implementing inline ghost text within a standard HTML `<textarea>` is technically impossible because `<textarea>` only supports a single text color and style. We must use an **Overlay Architecture**.

### 3.1 The Overlay Hack (Frontend UI)
The `ChatInput` will be refactored into a layered component:
1. **Layer 1 (Background Presenter)**: A `<div>` that perfectly mirrors the typography, padding, line-height, and dimensions of the textarea. This div renders two elements:
   - `<span className="text-transparent">`: The exact text the user has typed (to push the ghost text to the correct coordinate).
   - `<span className="text-[#A8A4A1]/50">`: The Ghost Text returned by the AI.
2. **Layer 2 (Foreground Input)**: The actual `<textarea>`. It handles all user interaction, focus, and scrolling. Its text color is set to standard (e.g., `text-[#1C1B1B]`), but its background is `transparent`. 

*Note: Strict synchronization of `scrollTop` and `scrollLeft` between Layer 1 and Layer 2 is required if the content exceeds the `max-h-[200px]` limit.*

### 3.2 State Management (`useChatInput.ts`)
We need to introduce state for managing the prediction lifecycle:
```typescript
const [ghostText, setGhostText] = useState<string>('');
const [isPredicting, setIsPredicting] = useState<boolean>(false);
```

### 3.3 Debounced API Call
To prevent spamming the backend on every keystroke, a debounced effect will monitor `localInput`:
```typescript
useEffect(() => {
  if (!localInput.trim() || localInput.endsWith(' ')) {
    setGhostText('');
    return;
  }

  const handler = setTimeout(async () => {
    setIsPredicting(true);
    try {
      // Call specialized low-latency endpoint
      const suggestion = await fetchPromptCompletion(localInput);
      setGhostText(suggestion);
    } catch (e) {
      setGhostText('');
    } finally {
      setIsPredicting(false);
    }
  }, 500); // 500ms debounce

  return () => clearTimeout(handler);
}, [localInput]);
```

### 3.4 Keystroke Hijacking (`ChatInput.tsx`)
The `onKeyDown` handler must intercept the `Tab` key before it shifts browser focus.

```typescript
onKeyDown={(e) => {
  if (e.key === 'Tab' && ghostText) {
    e.preventDefault(); // Prevent focus shift
    setLocalInput(prev => prev + ghostText);
    setGhostText('');
    
    // Defer cursor update to next tick
    setTimeout(() => {
      if (textAreaRef.current) {
        const newLen = textAreaRef.current.value.length;
        textAreaRef.current.setSelectionRange(newLen, newLen);
      }
    }, 0);
    return;
  }
  
  // Dismiss ghost text on any other substantive keypress
  if (!['Shift', 'Control', 'Alt', 'Meta', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    setGhostText('');
  }
  
  // ... existing Enter / ArrowUp logic ...
}}
```

---

## 4. Backend & AI Model Strategy

The success of this feature hinges entirely on **Speed (< 300ms TTFB)** and **Conciseness**.

### 4.1 Model Selection
Do not use large, slow models (e.g., GPT-4, Claude-3-Opus) for this task.
- **Recommended**: Deploy a small, fast instruction-tuned model specifically for this endpoint (e.g., `Qwen2.5-Coder-7B-Instruct`, `Llama-3-8B-Instruct`, or `MiniMax` fast tier).

### 4.2 API Endpoint Design
Create a dedicated lightweight endpoint: `POST /api/chat/autocomplete`
- **Input**: `{ "prefix": "帮我看看这个合同的 IP 条款" }`
- **Output**: `{ "completion": "，重点分析知识产权的归属权，以及加州劳动法第2870条的适用性。" }`

### 4.3 System Prompt Engineering
The system prompt for the autocomplete model must strictly enforce format and continuation constraints.

```text
You are an expert prompt engineer assistant. 
Your task is to autocomplete the user's unfinished prompt to make it more professional, detailed, and context-aware.

RULES:
1. ONLY output the continuation text. Do NOT repeat the user's input.
2. Do not include quotes, explanations, or conversational filler.
3. Keep it under 2 sentences.
4. If the user's input is already complete or clear, output an empty string.

USER INPUT: "{prefix}"
COMPLETION:
```

---

## 5. Development Phases

**Phase 1: Foundation (Frontend Overlay)**
- Implement the "Layer 1 / Layer 2" transparent overlay hack in `ChatInput.tsx`.
- Hardcode a dummy `ghostText` string to verify CSS alignment, fonts, and scrolling synchronization.
- Implement the `Tab` key interception logic.

**Phase 2: State & Debounce**
- Integrate `useState` for `ghostText` and the `useEffect` debounce logic in `useChatInput.ts`.
- Ensure cursor movements and typing properly clear the ghost text state.

**Phase 3: Backend & AI Integration**
- Create the `/api/chat/autocomplete` route in the NestJS Gateway.
- Connect it to the fastest available LLM provider in the workspace.
- Tune the System Prompt based on real-world legal/coding queries to ensure the completions are genuinely helpful.