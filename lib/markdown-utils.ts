export function slackToMarkdown(text: string): string {
    if (!text) return "";

    let md = text;

    // Bold: *text* -> **text**
    // We need to be careful not to match * in lists
    // Slack bold requires boundary logic usually, but simple regex:
    // (?<=^|[\s[:punct:]])\*(.+)\*(?=$|[\s[:punct:]])
    // Simplified for now:
    md = md.replace(/\*([^\*]+)\*/g, '**$1**');

    // Italic: _text_ -> *text*
    md = md.replace(/_([^_]+)_/g, '*$1*');

    // Strikethrough: ~text~ -> ~~text~~
    md = md.replace(/~([^~]+)~/g, '~~$1~~');

    // Quotes: Ensure space after > at start of line or string
    // Slack: >Text -> MD: > Text
    md = md.replace(/^>([^\s])/gm, '> $1');
    md = md.replace(/&gt;/g, '>');

    // Code blocks: Convert ```content``` to
    // ```
    // content
    // ```
    // This handling ensures that text immediately following the opening ticks is treated as content,
    // and ensures fences have their own lines.
    md = md.replace(/```([\s\S]*?)```/g, (match, content) => {
        return '\n```\n' + content + '\n```\n';
    });
    // Remove extra newlines possibly created by the above if any
    // md = md.replace(/\n{3,}/g, '\n\n');

    // Links: <url|text> -> [text](url)
    md = md.replace(/<([^|>]+)\|([^>]+)>/g, '[$2]($1)');

    // Links: <url> -> [url](url)
    md = md.replace(/<([^|>]+)>/g, '$1');

    return md;
}
