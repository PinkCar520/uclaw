from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models import SkillTriggerLog
import uuid
import asyncio

# Lazy load embedding to avoid blocking startup
from embedding import generate_embedding

router = APIRouter(prefix="/api/internal/skills", tags=["skills"])

class ResolveRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    skill_ids: Optional[List[str]] = None

class ResolveResponse(BaseModel):
    injected_prompt: str
    matched_skills: List[dict]

@router.post("/resolve", response_model=ResolveResponse)
def resolve_skills(request: ResolveRequest, db: Session = Depends(get_db)):
    # 1. 优先获取所有有效的 Skill
    skills_query = text("SELECT id, name, description, content, \"triggerKws\", embedding FROM skills WHERE \"isPublic\" = true")
    result = db.execute(skills_query)
    all_skills = result.fetchall()
    
    matched_skills = []
    user_msg_lower = request.message.lower()
    
    # 2. 区分已命中的和未命中的（用于 Embedding 兜底匹配）
    pending_skills = []
    
    for row in all_skills:
        skill_id = row[0]
        name = row[1]
        desc = row[2]
        content = row[3]
        trigger_kws = row[4]
        # embedding is row[5], but we'll do vector match in memory or via DB query.
        # Since we already fetched all skills, we can do keyword match first.
        
        should_trigger = False
        match_type = ""
        
        # 策略 A: 显式指定 (SK-06 斜杠命令强制命中)
        if request.skill_ids and skill_id in request.skill_ids:
            should_trigger = True
            match_type = "explicit"
            
        # 策略 B: 关键词精确匹配
        elif trigger_kws:
            for kw in trigger_kws:
                if kw.lower() in user_msg_lower:
                    should_trigger = True
                    match_type = "keyword"
                    break
                    
        if should_trigger:
            matched_skills.append({
                "id": skill_id,
                "name": name,
                "content": content,
                "match_type": match_type
            })
        else:
            pending_skills.append(row)
            
    # 策略 C: Embedding 语义匹配 (仅当没有任何命中或者需要补全时)
    # 如果关键词没命中，我们用 Embedding 在剩余的 skill 中找
    if pending_skills and len(matched_skills) < 3:
        try:
            # 生成用户消息的 embedding
            user_embedding = generate_embedding(request.message)
            
            # 使用 pgvector 在数据库层做查询
            # 为了简单，我们构建一个包含了 pending skill ID 的查询
            pending_ids = tuple([s[0] for s in pending_skills])
            if pending_ids:
                vector_query = text("""
                    SELECT id, name, content, 1 - (embedding <=> :emb::vector) as score
                    FROM skills
                    WHERE id IN :p_ids
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> :emb::vector
                    LIMIT 2
                """)
                v_res = db.execute(vector_query, {"emb": str(user_embedding), "p_ids": pending_ids})
                for v_row in v_res:
                    # 假定阈值 > 0.4 算作命中
                    if v_row[3] > 0.4:
                        matched_skills.append({
                            "id": v_row[0],
                            "name": v_row[1],
                            "content": v_row[2],
                            "match_type": f"embedding (score: {v_row[3]:.2f})"
                        })
        except Exception as e:
            print("Embedding match failed:", e)

    # 去重
    seen = set()
    final_matched = []
    for s in matched_skills:
        if s["id"] not in seen:
            final_matched.append(s)
            seen.add(s["id"])

    injected_prompt = ""
    if final_matched:
        injected_prompt += "<injected_skills>\n"
        injected_prompt += "以下为你注入了多个专门领域的AI专家技能，请根据用户的问题，综合运用它们的规则来回答。\n"
        for s in final_matched:
            injected_prompt += f'<skill name="{s["name"]}">\n'
            injected_prompt += f'{s["content"]}\n'
            injected_prompt += f'</skill>\n'
        injected_prompt += "</injected_skills>\n"
        
    # 记录触发日志 (SK-10)
    try:
        log = SkillTriggerLog(
            sessionId=request.session_id,
            messageId=str(uuid.uuid4()), # 暂无 message_id，用新的顶替
            triggeredIds=[s["id"] for s in final_matched],
            injectedTokens=len(injected_prompt) // 4  # 粗略估算
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print("Failed to save trigger log:", e)
        db.rollback()
        
    return ResolveResponse(
        injected_prompt=injected_prompt,
        matched_skills=[{"id": s["id"], "name": s["name"], "match_type": s.get("match_type")} for s in final_matched]
    )
