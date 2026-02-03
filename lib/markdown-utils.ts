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

    // Quotes: > text (Standard MD handles this, but Slack often uses &gt;)
    md = md.replace(/&gt;/g, '>');

    // Newlines are handled by remark-breaks usually, but just in case
    // md = md.replace(/\n/g, '  \n'); 

    return md;
}
