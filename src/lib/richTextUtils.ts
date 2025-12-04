/**
 * Convert HTML content from contentEditable to markdown
 */
export function htmlToMarkdown(html: string): string {
  let markdown = html;
  
  // Convert <strong> and <b> to **text**
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  
  // Convert <em> and <i> to *text*
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  
  // Convert <code> to `code`
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Convert <br> and <div> to newlines
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/div>/gi, '\n');
  markdown = markdown.replace(/<div[^>]*>/gi, '');
  
  // Remove other HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");
  
  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  return markdown.trim();
}

/**
 * Convert markdown to HTML for display in contentEditable
 * This function converts markdown syntax to HTML that will be rendered visually
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // Split by lines to preserve line breaks
  const lines = markdown.split('\n');
  
  const htmlLines = lines.map(line => {
    if (!line.trim()) {
      return '<br>'; // Empty lines become <br>
    }
    
    let html = line;
    
    // Step 1: Convert `code` blocks first (before other formatting)
    html = html.replace(/`([^`]+)`/g, '<code class="bg-neutral-800 px-1.5 py-0.5 rounded text-sm text-ccaBlue">$1</code>');
    
    // Step 2: Convert **bold** text
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    
    // Step 3: Convert *italic* text (but not **bold**)
    // Use negative lookbehind and lookahead to avoid matching **
    html = html.replace(/(?<!\*)\*([^*\n`]+?)\*(?!\*)/g, '<em>$1</em>');
    
    // Step 4: Escape HTML entities in plain text, but preserve our created tags
    // We'll use a two-pass approach: first mark our tags, then escape, then restore
    
    // Create a temporary DOM element to help with escaping
    const tempDiv = document.createElement('div');
    
    // Store our HTML tags temporarily
    const tagStore: string[] = [];
    let tagIndex = 0;
    
    // Replace our tags with placeholders
    html = html.replace(/<(strong|em|code)[^>]*>.*?<\/\1>/g, (match) => {
      const placeholder = `__TAG_${tagIndex}__`;
      tagStore[tagIndex] = match;
      tagIndex++;
      return placeholder;
    });
    
    // Escape HTML in the remaining text
    tempDiv.textContent = html;
    html = tempDiv.innerHTML;
    
    // Restore our HTML tags
    for (let i = 0; i < tagStore.length; i++) {
      html = html.replace(`__TAG_${i}__`, tagStore[i]);
    }
    
    return html;
  });
  
  // Join lines (they already have <br> for empty lines)
  return htmlLines.join('');
}

/**
 * Apply formatting command to contentEditable element
 */
export function applyFormatting(command: 'bold' | 'italic' | 'code', editorRef: React.RefObject<HTMLDivElement | null>) {
  if (!editorRef.current) return;
  
  const editor = editorRef.current;
  editor.focus();
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  
  try {
    switch (command) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'code':
        // For code, we'll wrap in a code element
        if (range.collapsed) {
          // Insert placeholder if nothing selected
          const codeNode = document.createElement('code');
          codeNode.className = 'bg-neutral-800 px-1.5 py-0.5 rounded text-sm text-ccaBlue';
          codeNode.textContent = 'code';
          range.insertNode(codeNode);
          range.setStartAfter(codeNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // Wrap selected text
          const codeNode = document.createElement('code');
          codeNode.className = 'bg-neutral-800 px-1.5 py-0.5 rounded text-sm text-ccaBlue';
          try {
            range.surroundContents(codeNode);
          } catch (e) {
            // If surroundContents fails, extract and wrap
            const contents = range.extractContents();
            codeNode.appendChild(contents);
            range.insertNode(codeNode);
          }
        }
        break;
    }
  } catch (e) {
    console.error('Error applying formatting:', e);
  }
  
  // Trigger input event to update content
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}
