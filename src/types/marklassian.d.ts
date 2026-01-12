declare module 'marklassian' {
  /**
   * Convert Markdown to Atlassian Document Format (ADF)
   * @param markdown - GitHub Flavored Markdown text
   * @returns ADF document object
   */
  export function markdownToAdf(markdown: string): {
    version: number;
    type: string;
    content: any[];
  };
}
