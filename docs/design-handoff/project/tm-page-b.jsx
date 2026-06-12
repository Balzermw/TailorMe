// tm-page-b.jsx — standalone mount for Direction B ("Show the machine").
// Full-bleed responsive page + tweaks panel.

const TWEAK_DEFAULTS_B = /*EDITMODE-BEGIN*/{
  "headline": "stronger",
  "density": "regular",
  "tints": true,
  "pricingEmphasis": "popular"
}/*EDITMODE-END*/;

const TM_HEADLINE_OPTIONS_B = [
  { value: 'stronger', label: '“…stronger than your resume makes it look.”' },
  { value: 'shows', label: '“Same experience. A resume that finally shows it.”' },
  { value: 'tasklist', label: '“Your resume reads like a task list. Your work isn’t.”' },
];

function PageB() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS_B);
  return (
    <React.Fragment>
      <div className="tm--page-wrap">
        <DirectionB t={t} pageMode={true} />
      </div>
      <TweaksPanel>
        <TweakSection label="Copy" />
        <TweakSelect
          label="Hero headline"
          value={t.headline}
          options={TM_HEADLINE_OPTIONS_B}
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

ReactDOM.createRoot(document.getElementById('root')).render(<PageB />);
