interface Props {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function MarkdownText({ content, className, style }: Props) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key++} style={{ paddingLeft: '1.4rem', margin: '0.5rem 0' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ marginBottom: '0.25rem' }}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={i}>{part.slice(1, -1)}</em>;
      return part;
    });
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={key++} style={{ margin: '1rem 0 0.3rem', fontSize: '0.95rem', fontWeight: 700 }}>{renderInline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={key++} style={{ margin: '1rem 0 0.3rem', fontSize: '1rem', fontWeight: 700 }}>{renderInline(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={key++} style={{ margin: '1rem 0 0.4rem', fontSize: '1.1rem', fontWeight: 700 }}>{renderInline(line.slice(2))}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      listItems.push(line.slice(2));
    } else if (line === '') {
      flushList();
      elements.push(<br key={key++} />);
    } else {
      flushList();
      elements.push(<p key={key++} style={{ margin: '0.25rem 0', lineHeight: 1.75 }}>{renderInline(line)}</p>);
    }
  }
  flushList();

  return <div className={className} style={style}>{elements}</div>;
}
