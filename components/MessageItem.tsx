import { Message } from '@/lib/types';
import { format } from 'date-fns';
import { User as UserIcon, File } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { slackToMarkdown } from '@/lib/markdown-utils';

interface MessageItemProps {
    message: Message;
    isThreadView?: boolean;
}

export function MessageItem({ message, isThreadView = false }: MessageItemProps) {
    const isBot = message.userIndex === 0; // Assuming 0 or specific logic if needed, but for now relying on user object

    return (
        <div className="group">
            <div className="flex gap-3 py-2 px-4 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                <div className="flex-shrink-0 mt-1">
                    <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded rounded-md flex items-center justify-center overflow-hidden">
                        <UserIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className="font-bold text-[15px] text-gray-900 dark:text-gray-100">
                            {message.user?.name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatStr(message.createdAt)}
                        </span>
                    </div>

                    <div className="text-[15px] leading-relaxed text-gray-900 dark:text-gray-200 break-words prose dark:prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                                // Override default element styling to match Slack a bit better
                                p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener" {...props} />,
                                pre: ({ node, ...props }) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2 overflow-x-auto" {...props} />,
                                code: ({ node, ...props }) => {
                                    // @ts-ignore
                                    const inline = props.inline || !String(props.className).includes('language-');
                                    return inline
                                        ? <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm text-red-500" {...props} />
                                        : <code className="block text-sm" {...props} />
                                },
                                blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 text-gray-500 italic mb-2" {...props} />,
                            }}
                        >
                            {slackToMarkdown(message.content)}
                        </ReactMarkdown>
                    </div>

                    {message.fileUrl && (
                        <div className="mt-2">
                            {message.fileUrl.split('\n').map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:underline text-sm">
                                    <File className="w-4 h-4" />
                                    Attachment {i + 1}
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {message.reactions.map((r, i) => (
                                <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-transparent rounded-full text-xs text-gray-700 dark:text-gray-300">
                                    <span>{r.name}</span>
                                    <span className="text-[10px] font-medium">{r.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>


            {/* Thread Replies Link - Only show if NOT in thread view and has replies */}
            {!isThreadView && message.replies && message.replies.length > 0 && (
                <div className="pl-14 pr-4 pb-2">
                    <Link
                        href={`?thread_ts=${message.slackTs}`}
                        className="flex items-center gap-2 group/thread"
                    >
                        <div className="flex -space-x-1">
                            {/* Simple avatar stack simulation or just users count */}
                            {message.replies.slice(0, 3).map((r, i) => (
                                <div key={i} className="w-5 h-5 rounded-sm bg-gray-300 dark:bg-gray-600 border border-white dark:border-gray-800 flex items-center justify-center">
                                    {/* Tiny placeholder */}
                                </div>
                            ))}
                        </div>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover/thread:underline">
                            {message.replies.length} replies
                        </span>
                        <span className="text-xs text-gray-400 group-hover/thread:text-gray-500">
                            Last reply {formatStr(message.replies[message.replies.length - 1].createdAt)}
                        </span>
                    </Link>
                </div>
            )}
        </div>
    );
}

function formatStr(dateStr: string) {
    // yyyyMMddHHmmss -> Date
    if (!dateStr || dateStr.length < 14) return dateStr;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(8, 10));
    const minute = parseInt(dateStr.substring(10, 12));

    const date = new Date(year, month, day, hour, minute);
    return format(date, 'MMM d, h:mm a');
}
