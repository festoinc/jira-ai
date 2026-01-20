/**
 * Utility to process mentions in Atlassian Document Format (ADF)
 */

export type UserResolver = (displayName: string) => Promise<string | null>;

/**
 * Traverses an ADF object and replaces mentions with mention nodes.
 * Mentions are identified as @DisplayName or [[~DisplayName]].
 * 
 * @param adf The ADF object to process
 * @param resolveUser A function that resolves a display name to an accountId
 */
export async function processMentionsInADF(adf: any, resolveUser: UserResolver): Promise<any> {
  if (!adf || typeof adf !== 'object') {
    return adf;
  }

  // If it's an array, process each element
  if (Array.isArray(adf)) {
    return Promise.all(adf.map(item => processMentionsInADF(item, resolveUser)));
  }

  const newAdf = { ...adf };

  // If it's a text node, check for mentions
  if (newAdf.type === 'text' && typeof newAdf.text === 'string') {
    const processedContent = await processTextNodeWithMentions(newAdf, resolveUser);
    if (processedContent.length > 1 || (processedContent.length === 1 && processedContent[0].type !== 'text')) {
      // We can't return an array if the parent expects a single node.
      // But wait, ADF text nodes are usually in a 'content' array.
      // So this function should probably be called by the parent to expand its content.
      return processedContent;
    }
    return processedContent[0];
  }

  // If it has content, process it
  if (newAdf.content && Array.isArray(newAdf.content)) {
    const newContent = [];
    for (const item of newAdf.content) {
      const result = await processMentionsInADF(item, resolveUser);
      if (Array.isArray(result)) {
        newContent.push(...result);
      } else {
        newContent.push(result);
      }
    }
    newAdf.content = newContent;
  }

  return newAdf;
}

/**
 * Processes a text node and returns an array of nodes (text and mention)
 */
async function processTextNodeWithMentions(node: any, resolveUser: UserResolver): Promise<any[]> {
  const text = node.text;
  const marks = node.marks;
  
  // Regex for mentions: 
  // 1. [[~DisplayName]]
  // 2. @DisplayName (matches multiple words, we will backtrack to find the best match)
  
  const explicitMentionRegex = /\[\[~([^\]]+)\]\]/g;
  const simpleMentionRegex = /@([a-zA-Z0-9._-]+(?: [a-zA-Z0-9._-]+)*)/g;
  
  let matches: { start: number; end: number; name: string; fullMatch: string; accountId: string }[] = [];
  
  // Find explicit mentions first as they are unambiguous
  let match;
  while ((match = explicitMentionRegex.exec(text)) !== null) {
    const name = match[1];
    const accountId = await resolveUser(name);
    if (accountId) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        name,
        fullMatch: match[0],
        accountId
      });
    }
  }
  
  // Find simple mentions (only in parts not already covered)
  // We reset the regex lastIndex because we might have called it before or want to be sure
  simpleMentionRegex.lastIndex = 0;
  while ((match = simpleMentionRegex.exec(text)) !== null) {
    const start = match.index;
    let fullMatch = match[0];
    let content = match[1];
    
    // Check if this overlaps with any explicit mention
    const overlaps = matches.some(m => (start >= m.start && start < m.end));
    if (overlaps) continue;

    // Backtracking to find the best match
    const words = content.split(' ');
    let resolvedId: string | null = null;
    let resolvedName = '';
    let resolvedEndIndex = start + 1; // After '@'

    for (let i = words.length; i > 0; i--) {
      const currentName = words.slice(0, i).join(' ');
      const accountId = await resolveUser(currentName);
      if (accountId) {
        resolvedId = accountId;
        resolvedName = currentName;
        resolvedEndIndex = start + 1 + currentName.length;
        break;
      }
    }

    if (resolvedId) {
      matches.push({
        start,
        end: resolvedEndIndex,
        name: resolvedName,
        fullMatch: `@${resolvedName}`,
        accountId: resolvedId
      });
      // Move regex lastIndex to after our match
      simpleMentionRegex.lastIndex = resolvedEndIndex;
    }
  }
  
  if (matches.length === 0) {
    return [node];
  }
  
  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);
  
  const result: any[] = [];
  let lastIndex = 0;
  
  for (const m of matches) {
    // It's possible that a later simple match now overlaps because we sorted them
    // but we processed them in a way that should avoid most overlaps.
    if (m.start < lastIndex) continue;

    // Add text before mention
    if (m.start > lastIndex) {
      result.push({
        type: 'text',
        text: text.substring(lastIndex, m.start),
        ...(marks ? { marks } : {})
      });
    }
    
    result.push({
      type: 'mention',
      attrs: {
        id: m.accountId,
        text: `@${m.name}`
      }
    });
    
    lastIndex = m.end;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      text: text.substring(lastIndex),
      ...(marks ? { marks } : {})
    });
  }
  
  return result;
}
