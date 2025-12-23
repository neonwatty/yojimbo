import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettingsStore } from '../../store/settingsStore';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  return (
    <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Custom code block with syntax highlighting
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !className;

          if (isInline) {
            return (
              <code
                className="bg-surface-700 px-1.5 py-0.5 rounded text-accent font-mono text-sm"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={match ? match[1] : 'text'}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          );
        },
        // Links open in new tab
        a({ href, children, ...props }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-bright underline"
              {...props}
            >
              {children}
            </a>
          );
        },
        // Style tables
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto">
              <table className="border-collapse border border-surface-600" {...props}>
                {children}
              </table>
            </div>
          );
        },
        th({ children, ...props }) {
          return (
            <th className="border border-surface-600 bg-surface-700 px-3 py-2 text-left" {...props}>
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td className="border border-surface-600 px-3 py-2" {...props}>
              {children}
            </td>
          );
        },
        // Style blockquotes
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="border-l-4 border-accent pl-4 italic text-theme-secondary"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        // Style lists
        ul({ children, ...props }) {
          return (
            <ul className="list-disc list-inside space-y-1" {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-decimal list-inside space-y-1" {...props}>
              {children}
            </ol>
          );
        },
        // Style headings
        h1({ children, ...props }) {
          return (
            <h1 className="text-2xl font-bold text-theme-primary mb-4 pb-2 border-b border-surface-600" {...props}>
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          return (
            <h2 className="text-xl font-semibold text-theme-primary mt-6 mb-3" {...props}>
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          return (
            <h3 className="text-lg font-medium text-theme-primary mt-4 mb-2" {...props}>
              {children}
            </h3>
          );
        },
        // Style paragraphs
        p({ children, ...props }) {
          return (
            <p className="text-theme-secondary mb-3 leading-relaxed" {...props}>
              {children}
            </p>
          );
        },
        // Style horizontal rules
        hr({ ...props }) {
          return <hr className="border-surface-600 my-6" {...props} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
