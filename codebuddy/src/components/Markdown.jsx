import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import toast from 'react-hot-toast';
import { copy } from '../lib/utils';

const hastText = (n) => (n.type === 'text' ? n.value : (n.children || []).map(hastText).join(''));

function CodeBlock({ node, children, onOpenCode }) {
  const codeEl = node?.children?.find((c) => c.tagName === 'code');
  const cls = codeEl?.properties?.className || [];
  const lang = (cls.find((c) => String(c).startsWith('language-')) || '').replace('language-', '');
  const code = codeEl ? hastText(codeEl).replace(/\n$/, '') : '';
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{lang || 'code'}</span>
        <div>
          <button type="button" onClick={async () => toast.success((await copy(code)) ? 'Copied' : 'Copy failed')}>
            Copy
          </button>
          {onOpenCode && (
            <button type="button" onClick={() => onOpenCode(code, lang)}>
              Open in editor ↗
            </button>
          )}
        </div>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

// Markdown renderer for AI answers. skipHtml = raw HTML is never rendered (XSS-safe).
export default function Markdown({ children, onOpenCode }) {
  return (
    <div className="md">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ node, children: c }) => (
            <CodeBlock node={node} onOpenCode={onOpenCode}>
              {c}
            </CodeBlock>
          ),
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
