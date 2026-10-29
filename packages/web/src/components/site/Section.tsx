// Shared layout primitives so every section lines up on the same wide grid.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import FadeContent from '@/components/FadeContent';

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1440px] px-6 md:px-12', className)}>{children}</div>;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('label-mono text-muted-foreground', className)}>{children}</p>;
}

/** Two-tone heading: the point in ink, the rest in grey. */
export function Heading({ strong, soft, as: Tag = 'h2', className }: { strong: string; soft?: string; as?: 'h1' | 'h2'; className?: string }) {
  return (
    <Tag className={cn('font-semibold tracking-[-0.035em] text-balance', className)}>
      {strong} {soft && <span className="text-neutral-400">{soft}</span>}
    </Tag>
  );
}

/** Editorial split: heading column on the left, content on the right. */
export function Split({ id, index, strong, soft, note, children }: {
  id: string; index: string; strong: string; soft: string; note: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-28 md:py-36">
      <Container className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <FadeContent className="lg:col-span-5" blur duration={900}>
          <Label className="mb-6">{index}</Label>
          <Heading strong={strong} soft={soft} className="mb-6 text-4xl leading-[1.05] md:text-5xl" />
          <div className="max-w-[46ch] text-muted-foreground">{note}</div>
        </FadeContent>
        <FadeContent className="lg:col-span-7" blur duration={900} delay={150}>
          {children}
        </FadeContent>
      </Container>
    </section>
  );
}
