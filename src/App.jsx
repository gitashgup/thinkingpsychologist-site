const trustStrip = [
  "AI Solutions @ J.P. Morgan",
  "16+ Years Global Experience",
  "Innovation Award Winner",
  "Host of Thinking Psychologist"
];

const serviceAreas = [
  {
    title: "AI Leadership and Transformation",
    summary:
      "For leaders and teams navigating enterprise AI, change, and the human side of adoption.",
    points: ["AI adoption strategy", "Risk-aware transformation", "Enterprise agency"]
  },
  {
    title: "Communication and Emotional Intelligence",
    summary:
      "For managers, teams, and emerging leaders who need stronger conversations, better trust, and more effective collaboration.",
    points: ["Difficult conversations", "Feedback culture", "Trust and collaboration"]
  },
  {
    title: "Culture and Change Facilitation",
    summary:
      "For organisations building healthier cultures during growth, restructuring, digital transformation, or operating model shifts.",
    points: ["Human-centred change", "Behaviour change", "Culture shift"]
  },
  {
    title: "Women in Leadership",
    summary:
      "For high-potential women leaders building voice, presence, confidence, and influence.",
    points: ["Voice and visibility", "Executive presence", "Confidence and influence"]
  }
];

const whyAshwarya = [
  {
    title: "Enterprise-grounded",
    body: "Currently leading AI Solutions for Collateral and Servicing at J.P. Morgan, Ashwarya works on operationalising AI in high-stakes enterprise environments."
  },
  {
    title: "Psychology-led",
    body: "His long-standing interest in psychology and human behaviour shapes the way he thinks about leadership, communication, adoption, and culture."
  },
  {
    title: "Transformation-focused",
    body: "He helps organisations move beyond innovation theatre into practical, people-ready execution that can hold under real-world pressure."
  }
];

const signaturePrograms = [
  {
    title: "Leading in the Era of Enterprise Agency",
    audience: "Senior leaders, transformation teams, AI leaders, operations heads, and innovation teams",
    description:
      "How leadership changes when organisations move from automation and copilots toward agentic systems, new operating models, and risk-aware AI deployment."
  },
  {
    title: "Emotional Intelligence at Work",
    audience: "Managers, emerging leaders, team leads, and cross-functional teams",
    description:
      "Self-awareness, emotional regulation, empathy, listening, trust, and the impact of emotional habits on leadership and team performance."
  },
  {
    title: "Communicating with Clarity and Influence",
    audience: "Leadership teams, managers, business partners, and high-potential professionals",
    description:
      "How to communicate with greater confidence, clarity, and credibility across difficult conversations, stakeholder settings, and moments of pressure."
  },
  {
    title: "Human-Centred AI Adoption in Regulated Organisations",
    audience: "Enterprise teams, governance leaders, risk teams, AI program teams, and leadership groups",
    description:
      "The cultural and behavioural side of AI adoption in environments where trust, auditability, and safety matter."
  },
  {
    title: "Building Cultures of Trust and Ownership",
    audience: "Leadership teams, HR/L&D teams, and teams in transition",
    description:
      "How culture is shaped through communication, accountability, psychological safety, and everyday leadership habits."
  },
  {
    title: "Women in Leadership: Voice, Presence, and Power",
    audience: "Women leaders, high-potential cohorts, and leadership development programs",
    description:
      "Voice, confidence, boundaries, executive presence, self-trust, communication, and influence."
  }
];

const outcomes = [
  "Leaders with stronger self-awareness and judgment",
  "Healthier, clearer communication across teams",
  "Greater readiness for AI-enabled change",
  "More thoughtful adoption of new technology",
  "Stronger cultures of trust, accountability, and ownership",
  "Workshops that are strategic, grounded, and deeply human"
];

const formats = [
  {
    label: "Keynotes",
    copy: "For conferences, leadership events, and internal forums."
  },
  {
    label: "Workshops",
    copy: "Interactive sessions for teams, managers, and leadership groups."
  },
  {
    label: "Offsites",
    copy: "Facilitated strategy and reflection experiences for leaders in transition."
  },
  {
    label: "Cohort Programs",
    copy: "Multi-session journeys for deeper capability building."
  },
  {
    label: "Custom Interventions",
    copy: "Bespoke programs tailored to your organisation's context."
  }
];

const speakingTopics = [
  "Leading in the Age of Enterprise AI",
  "The Human Side of AI Adoption",
  "Emotional Intelligence for Modern Leadership",
  "Communication, Trust, and Culture in Times of Change",
  "Women in Leadership and the Psychology of Presence",
  "Innovation, Uncertainty, and Building Resilient Teams"
];

const organizationNeeds = [
  "Build leadership readiness for AI-enabled transformation",
  "Strengthen communication and emotional intelligence across teams",
  "Support managers during periods of change",
  "Create healthier cultures of ownership and trust",
  "Design more human-centred approaches to transformation"
];

function App() {
  return (
    <div className="site-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <a className="brand" href="#hero">
          <span className="brand-mark">AG</span>
          <span className="brand-copy">
            <strong>Ashwarya Gupta</strong>
            <span>Human insight for AI, leadership, and change.</span>
          </span>
        </a>

        <nav className="nav">
          <a href="#about">About</a>
          <a href="#programs">Programs</a>
          <a href="#speaking">Speaking</a>
          <a href="#organisations">Organisations</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="hero">
          <div className="hero-copy">
            <p className="eyebrow">AI transformation leader, psychology-led facilitator, and speaker</p>
            <h1>Ashwarya Gupta</h1>
            <p className="hero-lead">Helping leaders and organisations adopt AI, lead change, and build more human, resilient cultures.</p>
            <p className="hero-text">
              Ashwarya Gupta brings together 16+ years of global experience across innovation, product strategy, and
              enterprise systems with a deep interest in psychology and human behaviour. He helps organisations
              navigate the real challenge of transformation: not just the technology, but the people, trust,
              communication, and culture required to make change work.
            </p>

            <div className="hero-actions">
              <a className="button button-primary" href="#contact">
                Book a Discovery Call
              </a>
              <a className="button button-secondary" href="#programs">
                Explore Programs
              </a>
            </div>

            <ul className="hero-pills" aria-label="Trust markers">
              {trustStrip.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <aside className="hero-panel">
            <div className="panel-label">Core positioning</div>
            <h3>Where enterprise AI meets human insight.</h3>
            <p>
              Most organisations do not struggle only with technology. They struggle with adoption, alignment, fear,
              communication, and the behavioural friction that comes with change. Ashwarya works at that intersection.
            </p>
            <ul className="hero-panel-list">
              <li>AI transformation and leadership readiness</li>
              <li>Communication, EQ, and trust-building</li>
              <li>Culture change and human-centred adoption</li>
            </ul>
          </aside>
        </section>

        <section className="section section-grid" id="offerings">
          <div className="section-heading">
            <p className="eyebrow">What I Do</p>
            <h2>Helping organisations move from innovation talk to practical, people-ready execution.</h2>
            <p>
              Ashwarya helps leaders and teams navigate AI transformation with greater clarity and trust, strengthen
              communication and emotional intelligence at work, build cultures of ownership and resilience, and move
              beyond proofs of concept toward meaningful organisational change.
            </p>
          </div>

          <div className="offer-grid offer-grid-wide">
            {serviceAreas.map((item) => (
              <article className="card offer-card" key={item.title}>
                <p className="card-kicker">{item.title}</p>
                <p className="card-summary">{item.summary}</p>
                <ul className="mini-list">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section intro-band" id="about">
          <div className="card intro-card">
            <p className="eyebrow">About Ashwarya</p>
            <h2>A rare combination of enterprise credibility and behavioural depth.</h2>
            <p>
              Ashwarya Gupta is an AI transformation leader, facilitator, speaker, and host of the Thinking
              Psychologist podcast. With 16+ years of global experience spanning innovation, product strategy,
              automation, and enterprise systems, he has built his career at the intersection of technology, business
              value, and human behaviour.
            </p>
            <p>
              His current work focuses on deploying AI solutions in complex enterprise environments, with particular
              emphasis on governance, operational architecture, and safe adoption at scale. Alongside that, his
              long-standing interest in psychology shapes the way he thinks about leadership, communication, change,
              and culture.
            </p>
          </div>

          <div className="pillar-grid">
            {whyAshwarya.map((item) => (
              <article className="card pillar-card" key={item.title}>
                <p className="card-kicker">{item.title}</p>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section">
          <div className="card statement-card">
            <p className="eyebrow">Why This Matters</p>
            <h2>Most AI speakers do not understand behaviour. Most leadership trainers have not built production-grade AI systems.</h2>
            <p>
              Ashwarya's work is especially relevant for organisations that want to move beyond AI hype and build the
              mindset, structures, and human readiness required for meaningful transformation.
            </p>
          </div>

          <div className="card proof-card">
            <p className="eyebrow">Outcomes</p>
            <ul className="stack-list">
              {outcomes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="programs">
          <div className="section-heading narrow">
            <p className="eyebrow">Programs</p>
            <h2>Programs designed for the realities of leadership today.</h2>
            <p>
              Sessions can be adapted for executive teams, managers, L&amp;D cohorts, universities, and institutional
              audiences.
            </p>
          </div>

          <div className="program-grid detailed-program-grid">
            {signaturePrograms.map((program) => (
              <article className="card program-detail-card" key={program.title}>
                <h3>{program.title}</h3>
                <p className="program-audience">{program.audience}</p>
                <p>{program.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section">
          <div className="card formats-card">
            <p className="eyebrow">Formats</p>
            <div className="format-list format-list-wide">
              {formats.map((item) => (
                <article className="format-item" key={item.label}>
                  <h3>{item.label}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="card audience-card">
            <p className="eyebrow">Best Fit Audiences</p>
            <div className="audience-grid">
              <span className="audience-pill">Corporate leadership teams</span>
              <span className="audience-pill">Managers and emerging leaders</span>
              <span className="audience-pill">HR and L&amp;D teams</span>
              <span className="audience-pill">Enterprise AI and transformation teams</span>
              <span className="audience-pill">Universities and educator communities</span>
              <span className="audience-pill">Women's leadership cohorts</span>
            </div>
          </div>
        </section>

        <section className="section split-section" id="speaking">
          <div className="card statement-card">
            <p className="eyebrow">Speaking</p>
            <h2>Talks that combine strategic clarity with psychological depth.</h2>
            <p>
              Ashwarya speaks on AI, leadership, human behaviour, and the cultural realities of change. His talks are
              particularly strong in rooms where technology and human systems intersect.
            </p>
          </div>

          <div className="card proof-card">
            <p className="eyebrow">Speaking Topics</p>
            <ul className="stack-list">
              {speakingTopics.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section split-section" id="organisations">
          <div className="card statement-card">
            <p className="eyebrow">For Organisations</p>
            <h2>Transformation is never only technical. It is human.</h2>
            <p>
              Ashwarya works with organisations that want to adopt AI more thoughtfully, support managers during
              periods of change, strengthen communication and emotional intelligence, and create healthier cultures of
              ownership and trust.
            </p>
          </div>

          <div className="card proof-card">
            <p className="eyebrow">Common Needs</p>
            <ul className="stack-list">
              {organizationNeeds.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section final-cta" id="contact">
          <div className="final-cta-copy">
            <p className="eyebrow">Let's Work Together</p>
            <h2>Bring Ashwarya in for your next leadership, AI, or culture conversation.</h2>
            <p>
              If you are looking for a keynote speaker, workshop facilitator, or thought partner for leadership, AI
              adoption, communication, or culture change, Ashwarya brings a perspective that is both strategic and
              deeply human.
            </p>
            <ul className="stack-list">
              <li>Tell me about your audience</li>
              <li>Share the challenge you are solving</li>
              <li>Let me know the format you have in mind</li>
              <li>I'll come back with the best-fit approach</li>
            </ul>
          </div>

          <div className="cta-card">
            <p className="eyebrow">Contact</p>
            <a className="button button-primary" href="mailto:hello@thinkingpsychologist.com">
              hello@thinkingpsychologist.com
            </a>
            <a className="button button-secondary" href="https://www.linkedin.com/in/iknowash/">
              Connect on LinkedIn
            </a>
            <p>
              This CTA can later be replaced with a booking link, enquiry form, WhatsApp button, or downloadable
              workshop brochure.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
