import PlaygroundShell from './PlaygroundShell';

export const metadata = { title: 'Playground' };
export const dynamic = 'force-static';

export default function PlaygroundPage() {
  return (
    <div>
      <div className="micro">Playground · answers are mocked until providers land</div>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-white">Playground</h1>
      <p className="mt-1 max-w-[64ch] text-[13px] text-neutral-500">
        Pick a model, paste your key, hit enter — live calls through the gateway. No key, no calls: it echoes locally.
        Paste your Discord-issued key up top and it gets stored in this browser only — the shell
        will attach it as <span className="mono text-neutral-300">Bearer</span> once the backend is wired.
      </p>
      <div className="mt-5">
        <PlaygroundShell />
      </div>
    </div>
  );
}
