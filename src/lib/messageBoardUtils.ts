// Utility functions for message board features

/**
 * Extract hashtags from text content
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
}

/**
 * Extract mentions (@username) from text content
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map(mention => mention.substring(1)))];
}

/**
 * Parse rich text formatting (bold, italic, links, code)
 */
export function parseRichText(text: string): string {
  // Convert markdown-style formatting to HTML
  let parsed = text;
  
  // Bold: **text** or __text__
  parsed = parsed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  parsed = parsed.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  parsed = parsed.replace(/\*(.+?)\*/g, '<em>$1</em>');
  parsed = parsed.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Code: `code`
  parsed = parsed.replace(/`([^`]+)`/g, '<code class="bg-neutral-800 px-1.5 py-0.5 rounded text-sm">$1</code>');
  
  // Links: [text](url) or just URLs
  parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-ccaBlue hover:underline">$1</a>');
  
  // Auto-detect URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  parsed = parsed.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-ccaBlue hover:underline">$1</a>');
  
  // Convert newlines to <br>
  parsed = parsed.replace(/\n/g, '<br>');
  
  return parsed;
}

/**
 * Detect and convert external media URLs to embed codes
 */
export function detectMediaEmbeds(text: string): Array<{ type: 'youtube' | 'vimeo' | 'instagram' | 'url'; url: string; embedId?: string }> {
  const embeds: Array<{ type: 'youtube' | 'vimeo' | 'instagram' | 'url'; url: string; embedId?: string }> = [];
  
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = youtubeRegex.exec(text)) !== null) {
    embeds.push({ type: 'youtube', url: match[0], embedId: match[1] });
  }
  
  // Vimeo: vimeo.com/ID
  const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/g;
  while ((match = vimeoRegex.exec(text)) !== null) {
    embeds.push({ type: 'vimeo', url: match[0], embedId: match[1] });
  }
  
  // Instagram: instagram.com/p/ID
  const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/g;
  while ((match = instagramRegex.exec(text)) !== null) {
    embeds.push({ type: 'instagram', url: match[0], embedId: match[1] });
  }
  
  return embeds;
}

/**
 * Post categories
 */
export const POST_CATEGORIES = [
  { id: 'gear', label: 'Gear Talk', icon: '📷' },
  { id: 'on-set', label: 'On-Set Stories', icon: '🎬' },
  { id: 'post-production', label: 'Post-Production', icon: '✂️' },
  { id: 'business', label: 'Business Advice', icon: '💼' },
  { id: 'showcase', label: 'Project Showcase', icon: '🎨' },
  { id: 'question', label: 'Question', icon: '❓' },
  { id: 'tip', label: 'Tip & Trick', icon: '💡' },
  { id: 'other', label: 'Other', icon: '💬' },
] as const;

export type PostCategory = typeof POST_CATEGORIES[number]['id'];

/**
 * Post templates
 */
export const POST_TEMPLATES = [
  {
    id: 'gear-review',
    name: 'Gear Review',
    icon: '📷',
    content: `**Gear:** [Product Name]
**Price:** $[Price]
**Rating:** [1-5] ⭐

**Pros:**
- 
- 

**Cons:**
- 
- 

**Overall:** `,
  },
  {
    id: 'project-showcase',
    name: 'Project Showcase',
    icon: '🎨',
    content: `**Project:** [Project Name]
**Client:** [Client Name]
**Duration:** [Timeline]

**Challenge:**
[Describe the main challenge]

**Solution:**
[Describe your approach]

**Result:**
[Share the outcome]`,
  },
  {
    id: 'question',
    name: 'Question',
    icon: '❓',
    content: `**Question:** [Your question here]

**Context:**
[Provide any relevant context]

**What I've tried:**
[If applicable]`,
  },
  {
    id: 'tip',
    name: 'Tip & Trick',
    icon: '💡',
    content: `**Tip:** [Tip title]

[Explain your tip here]

**When to use:**
[When this tip is most useful]`,
  },
  {
    id: 'on-set-story',
    name: 'On-Set Story',
    icon: '🎬',
    content: `**Project:** [Project Name]
**Location:** [Location]
**Date:** [Date]

**Story:**
[Share your on-set experience]`,
  },
] as const;

