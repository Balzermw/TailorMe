// tm-app.jsx — canvas + tweaks wiring for the TailorMe v2 exploration.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "headline": "stronger",
  "density": "regular",
  "tints": true,
  "pricingEmphasis": "popular"
}/*EDITMODE-END*/;

const TM_HEADLINE_OPTIONS = [
  { value: 'stronger', label: '“…stronger than your resume makes it look.”' },
  { value: 'shows', label: '“Same experience. A resume that finally shows it.”' },
  { value: 'tasklist', label: '“Your resume reads like a task list. Your work isn’t.”' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection
          id="homepage-v2"
          title="TailorMe homepage — v2"
          subtitle="Three directions, same 9-section story (PAS + SB7). Tweaks apply to all three: headline copy, density, section tints, pricing emphasis."
        >
          <DCArtboard id="dir-a" label="A · Quiet confidence — refined v1" width={1440} height={9200} style={{ height: 'auto' }}>
            <DirectionA t={t} />
          </DCArtboard>
          <DCArtboard id="dir-b" label="B · Show the machine — dense, data-forward" width={1440} height={7400} style={{ height: 'auto' }}>
            <DirectionB t={t} />
          </DCArtboard>
          <DCArtboard id="dir-c" label="C · Big type, human voice — editorial" width={1440} height={8800} style={{ height: 'auto' }}>
            <DirectionC t={t} />
          </DCArtboard>
          <DCPostIt id="notes" width={300}>
            Notes — v2 vs v1: sentence-case eyebrows (brief rule), 0.5px borders, no shadows.
            A evolves v1 with an animated hero document. B leads with the pipeline + terminal
            replay and a pricing table. C goes editorial: big type, pull-quote pains,
            centerpiece before/after. All copy keeps the no-promises guardrail. Pick a
            direction (or a mix) and I’ll ship it as a standalone responsive page.
          </DCPostIt>
        </DCSection>
      </DesignCanvas>
      <TweaksPanel>
        <TweakSection label="Copy" />
        <TweakSelect
          label="Hero headline"
          value={t.headline}
          options={TM_HEADLINE_OPTIONS}
          onChange={(v) => setTweak('headline', v)}
        />
        <TweakSection label="Layout" />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakToggle
          label="Section tints"
          value={t.tints}
          onChange={(v) => setTweak('tints', v)}
        />
        <TweakSection label="Pricing" />
        <TweakRadio
          label="Emphasis"
          value={t.pricingEmphasis}
          options={[
            { value: 'popular', label: 'popular' },
            { value: 'equal', label: 'equal' },
            { value: 'value', label: 'value' },
          ]}
          onChange={(v) => setTweak('pricingEmphasis', v)}
        />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
