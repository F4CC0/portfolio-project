import { useRef } from "react";
import { profile } from "./data/profile";
import ChatWidget from "./components/ChatWidget";
import AdminPanel from "./components/AdminPanel";
import "./index.css";

function Carousel({ id, children, className = "" }) {
  const trackRef = useRef(null);

  function scrollByAmount(direction) {
    const container = trackRef.current;
    if (!container) return;

    const amount = Math.min(container.clientWidth * 0.85, 420);
    container.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth"
    });
  }

  return (
    <div className={`carousel-shell reveal ${className}`}>
      <div className="carousel-controls">
        <button
          type="button"
          className="carousel-button"
          onClick={() => scrollByAmount("left")}
          aria-label={`Deslizar ${id} para a esquerda`}
        >
          ←
        </button>
        <button
          type="button"
          className="carousel-button"
          onClick={() => scrollByAmount("right")}
          aria-label={`Deslizar ${id} para a direita`}
        >
          →
        </button>
      </div>

      <div className="carousel-fade carousel-fade-left" aria-hidden="true"></div>
      <div className="carousel-fade carousel-fade-right" aria-hidden="true"></div>

      <div ref={trackRef} className="carousel-track">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-inner">
          <a href="#top" className="brand">
            GFS
          </a>

          <div className="nav-links">
            <a href="#sobre">Sobre</a>
            <a href="#destaques">Destaques</a>
            <a href="#habilidades">Skills</a>
            <a href="#experiencia">Experiência</a>
            <a href="#projetos">Projetos</a>
            <a href="#contato">Contato</a>
            <a href="#admin">Admin</a>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="hero-content hero-grid">
          <div className="hero-text fade-up">
            <div className="hero-mini">PORTFÓLIO · SOFTWARE · PESQUISA</div>
            <p className="hero-tag">{profile.title}</p>

            <h1>
              Guilherme
              <br />
              <span>Facco Silva</span>
            </h1>

            <p className="hero-subtitle">{profile.subtitle}</p>

            <div className="hero-links">
              <a href="#projetos" className="primary-link">
                Ver projetos
              </a>
              <a href="#contato">Falar comigo</a>
              <a href={profile.contacts.github} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href={profile.contacts.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </div>

            <div className="hero-stats">
              <div className="hero-stat-card">
                <span className="hero-stat-value">IC</span>
                <span className="hero-stat-label">Pesquisa no LEDES</span>
              </div>

              <div className="hero-stat-card">
                <span className="hero-stat-value">2026</span>
                <span className="hero-stat-label">ICSE-SEET aceito</span>
              </div>

              <div className="hero-stat-card">
                <span className="hero-stat-value">RAG</span>
                <span className="hero-stat-label">Projetos com IA aplicada</span>
              </div>
            </div>
          </div>

          <div className="hero-photo-wrap fade-up delay-2">
            <div className="hero-photo-glow"></div>
            <div className="hero-orbit orbit-1"></div>
            <div className="hero-orbit orbit-2"></div>

            <div className="hero-photo-card">
              <img
                src="/profile.jpg"
                alt="Foto de Guilherme Facco Silva"
                className="hero-photo"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="section" id="sobre">
          <div className="section-header">
            <span className="section-kicker">01</span>
            <h2>Sobre</h2>
          </div>

          <div className="card wide-card reveal">
            <p className="lead">
              Estudante de Engenharia de Software com interesse em pesquisa,
              desenvolvimento e inteligência aplicada a problemas reais.
            </p>

            {profile.about.map((item, index) => (
              <p key={index}>{item}</p>
            ))}
          </div>
        </section>

        <section className="section" id="destaques">
          <div className="section-header">
            <span className="section-kicker">02</span>
            <h2>Destaques</h2>
          </div>

          <div className="section-intro reveal">
            <p>
              Alguns pontos centrais da minha trajetória acadêmica, técnica e de pesquisa.
            </p>
          </div>

          <Carousel id="destaques">
            {profile.highlights.map((item, index) => (
              <div className="feature-card carousel-card feature-carousel-card" key={index}>
                <div className="feature-number">0{index + 1}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </Carousel>
        </section>

        <section className="section" id="habilidades">
          <div className="section-header">
            <span className="section-kicker">03</span>
            <h2>Habilidades</h2>
          </div>

          <div className="skills-grid">
            {Object.entries(profile.skills).map(([group, items]) => (
              <div className="card skill-card reveal" key={group}>
                <div className="skill-card-top">
                  <h3>{group}</h3>
                  <span className="skill-counter">{items.length}</span>
                </div>

                <div className="tags">
                  {items.map((item, index) => (
                    <span className="tag" key={index}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="experiencia">
          <div className="section-header">
            <span className="section-kicker">04</span>
            <h2>Experiência</h2>
          </div>

          <div className="timeline">
            {profile.experience.map((item, index) => (
              <div className="card timeline-card reveal" key={index}>
                <div className="timeline-top">
                  <div>
                    <h3>{item.role}</h3>
                    <p className="muted timeline-org">
                      <strong>{item.org}</strong>
                    </p>
                  </div>
                  <span className="timeline-period">{item.period}</span>
                </div>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section publication-section">
          <div className="section-header">
            <span className="section-kicker">05</span>
            <h2>Publicação</h2>
          </div>

          <div className="publication-card reveal">
            <div className="publication-badge">Research Highlight</div>
            <p className="publication-label">{profile.publication.venue}</p>
            <h3>{profile.publication.title}</h3>
            <p>{profile.publication.note}</p>
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <span className="section-kicker">06</span>
            <h2>Reconhecimentos</h2>
          </div>

          <Carousel id="reconhecimentos">
            {profile.awards.map((award, index) => (
              <div className="award-item carousel-card award-carousel-card" key={index}>
                <div className="award-badge">Destaque {index + 1}</div>
                <p>{award}</p>
              </div>
            ))}
          </Carousel>
        </section>

        <section className="section" id="projetos">
          <div className="section-header">
            <span className="section-kicker">07</span>
            <h2>Projetos</h2>
          </div>

          <div className="section-intro reveal">
            <p>
              Uma seleção de projetos e experiências que conectam software, pesquisa e aplicação prática.
            </p>
          </div>

          <Carousel id="projetos" className="projects-carousel-shell">
            {profile.projects.map((project, index) => (
              <article className="project-visual-card carousel-card" key={index}>
                <div className="project-image-wrap">
                  <img
                    src={project.image}
                    alt={project.alt || project.title}
                    className="project-image"
                  />
                  <div className="project-image-overlay"></div>
                  <span className="project-index-badge">0{index + 1}</span>
                </div>

                <div className="project-visual-content">
                  <div className="project-top">
                    <h3>{project.title}</h3>
                  </div>
                  <p className="stack">{project.stack}</p>
                  <p>{project.description}</p>
                </div>
              </article>
            ))}
          </Carousel>
        </section>

        <section className="section" id="contato">
          <div className="section-header">
            <span className="section-kicker">08</span>
            <h2>Contato</h2>
          </div>

          <div className="contact-grid">
            <a className="card contact-card reveal" href={`mailto:${profile.contacts.email}`}>
              <h3>Email</h3>
              <p>{profile.contacts.email}</p>
            </a>

            <a
              className="card contact-card reveal"
              href={profile.contacts.github}
              target="_blank"
              rel="noreferrer"
            >
              <h3>GitHub</h3>
              <p>F4CC0</p>
            </a>

            <a
              className="card contact-card reveal"
              href={profile.contacts.linkedin}
              target="_blank"
              rel="noreferrer"
            >
              <h3>LinkedIn</h3>
              <p>Guilherme Facco Silva</p>
            </a>
          </div>
        </section>

        <AdminPanel />
      </main>

      <ChatWidget />
    </div>
  );
}