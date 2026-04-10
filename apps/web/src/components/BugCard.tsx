import { Bug, User, AlertTriangle, CheckCircle2, Clock, Image as ImageIcon, ChevronDown, ChevronUp, Sparkles, Users2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import type { UIBugCardProps } from '../types/ui-protocol';

export type { UIBugCardProps };

export interface BugCardProps extends UIBugCardProps {
  onClick?: (bugId: string) => void;
}

function formatDescription(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return text.trim().replace(/\n{3,}/g, '\n\n');
}

function extractImages(html: string): string[] {
  if (!html) return [];
  const imgRegex = /<img[^>]+src="([^">]+)"/gi;
  const images: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  return images;
}

export function BugCard({
  id,
  title,
  status,
  assignee,
  severity,
  description,
  createdAt,
  onClick,
}: BugCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedStatus = (status ?? '').toLowerCase() as UIBugCardProps['status'];
  const normalizedSeverity = (severity ?? '').toLowerCase() as UIBugCardProps['severity'];

  const severityColors: Record<string, string> = {
    high: 'border-[#F43F5E] bg-[#F43F5E]/5 text-[#DC2626]',
    medium: 'border-[#F59E0B] bg-[#F59E0B]/5 text-[#D97706]',
    low: 'border-[#10B981] bg-[#10B981]/5 text-[#059669]',
  };

  const statusIcons: Record<string, ReactElement> = {
    active: <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />,
    resolved: <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />,
    closed: <CheckCircle2 className="w-3.5 h-3.5 text-[#716B67]" />,
  };

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : null;

  const cleanDescription = description ? formatDescription(description) : null;
  const imageUrls = description ? extractImages(description) : [];
  const hasImages = imageUrls.length > 0;
  const mentionsImages = !hasImages && (description?.toLowerCase().includes('图片') || description?.toLowerCase().includes('image'));

  return (
    <div
      className={cn(
        "group bg-white border border-[#E8E4E2] rounded-[20px] overflow-hidden transition-all shadow-[0_8px_30px_rgba(0,0,0,0.04)] mt-4 max-w-[520px]",
        onClick && "cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
      )}
      onClick={() => onClick?.(id)}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[#E8E4E2]/60">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-lg">
              <Bug className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-[#716B67] uppercase tracking-[0.15em]">{id}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border uppercase",
            severityColors[normalizedSeverity] || severityColors.medium
          )}>
            <AlertTriangle className="w-3 h-3" />
            {t(`bug.severity.${normalizedSeverity}`, normalizedSeverity)}
          </div>
        </div>
        <h3 className="text-[16px] font-bold text-[#1C1B1B] mt-2 leading-snug">{title}</h3>
      </div>

      {/* Description */}
      {cleanDescription && (
        <div className="px-6 py-4">
          <div className={cn(
            "text-[13px] text-[#716B67] leading-relaxed whitespace-pre-wrap bg-[#F6F3F2] p-4 rounded-[14px] transition-all duration-200",
            !isExpanded && "line-clamp-4 overflow-hidden"
          )}>
            {cleanDescription}
          </div>
          {(cleanDescription.split('\n').length > 4 || cleanDescription.length > 150) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {isExpanded ? t('common.show_less', '收起') : t('common.show_more', '展开全文')}
            </button>
          )}
        </div>
      )}

      {/* Images */}
      {hasImages && (
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          {imageUrls.map((url, index) => (
            <div key={index} className="relative aspect-video rounded-xl overflow-hidden border border-[#E8E4E2] bg-[#F6F3F2] min-w-[120px] max-w-[240px] flex-1">
              <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/f1f5f9/94a3b8?text=Image+Load+Error'; }} />
            </div>
          ))}
        </div>
      )}

      {mentionsImages && (
        <div className="px-6 pb-4 flex items-center gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-[11px] text-blue-600">
          <ImageIcon className="w-4 h-4 shrink-0" />
          <span>{t('bug.has_screenshot', '此缺陷包含截图，点击卡片查看详情')}</span>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#E8E4E2]/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#F6F3F2] flex items-center justify-center border border-[#E8E4E2]">
            <Users2 className="w-3.5 h-3.5 text-[#716B67]" />
          </div>
          <span className="text-[12px] font-semibold text-[#1C1B1B]">{assignee}</span>
        </div>
        <div className="flex items-center gap-2">
          {formattedDate && <span className="text-[11px] text-[#716B67]/70">{formattedDate}</span>}
          {statusIcons[normalizedStatus]}
          <span className="text-[11px] font-bold text-[#716B67]">
            {t(`bug.status.${normalizedStatus}`, normalizedStatus)}
          </span>
        </div>
      </div>
    </div>
  );
}
