import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCircle2,
  ClipboardList, Clock3, FileText, Radio, ShieldCheck, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/hero.webp';
import './Landing.css';

const workflow = [
  { title: 'Demande', tool: 'SIH', text: 'Le médecin prescrit l’examen et transmet le contexte clinique.' },
  { title: 'Planification', tool: 'RIS', text: 'L’équipe organise le rendez-vous et prépare le parcours.' },
  { title: 'Acquisition', tool: 'Modalité', text: 'La worklist accompagne la réalisation de l’examen.' },
  { title: 'Compte rendu', tool: 'Radiologie', text: 'Le radiologue rédige, valide et signe son interprétation.' },
  { title: 'Téléexpertise', tool: 'FHIR · IHE MHD', text: 'Les éléments utiles sont partagés avec le spécialiste.' },
];

const statusExamples = [
  { label: 'Demandé', tone: 'requested' },
  { label: 'Planifié', tone: 'scheduled' },
  { label: 'Réalisé', tone: 'performed' },
  { label: 'Terminé', tone: 'completed' },
];

function Brand({ light = false }) {
  return (
    <span className={`public-brand${light ? ' public-brand--light' : ''}`}>
      <span className="public-brand__mark"><Activity aria-hidden="true" /></span>
      <span>RadioPlatform</span>
    </span>
  );
}

function FeaturePreview({ type }) {
  if (type === 'request') {
    return (
      <div className="preview-request" aria-hidden="true">
        <span className="preview-request__icon"><ClipboardList /></span>
        <span className="preview-request__lines"><i /><i /><i /></span>
        <span className="preview-request__check"><Check /></span>
      </div>
    );
  }
  if (type === 'timeline') {
    return (
      <div className="preview-timeline" aria-hidden="true">
        <span className="preview-timeline__line" />
        {workflow.slice(0, 4).map((step, index) => (
          <span className={`preview-timeline__dot preview-timeline__dot--${index}`} key={step.title}>
            {index < 2 && <Check />}
          </span>
        ))}
        <span className="preview-timeline__label">Demande <b>En cours</b></span>
      </div>
    );
  }
  if (type === 'hl7') {
    return (
      <div className="preview-code" aria-hidden="true">
        <span>MSH|^~\&amp;|SIH|RADIO|RIS</span>
        <span>ORM^O01|Demande d’examen</span>
        <span>PID|Identité patient</span>
        <span>OBR|Modalité · Examen</span>
      </div>
    );
  }
  if (type === 'worklist') {
    return (
      <div className="preview-worklist" aria-hidden="true">
        <span><i /> Modalité</span><span className="preview-worklist__ready">Worklist prête</span>
      </div>
    );
  }
  if (type === 'fhir') {
    return (
      <div className="preview-fhir" aria-hidden="true">
        <span className="preview-fhir__node">ServiceRequest</span>
        <span className="preview-fhir__connector" />
        <span className="preview-fhir__node">DiagnosticReport</span>
      </div>
    );
  }
  return (
    <div className="preview-audit" aria-hidden="true">
      <span><i /> Demande créée <b>Traçable</b></span>
      <span><i /> Statut actualisé <b>Horodaté</b></span>
    </div>
  );
}

const features = [
  { type: 'request', title: 'Demande d’examen', text: 'Une prescription structurée, reliée au patient et à son indication clinique.', className: 'feature-card--request' },
  { type: 'timeline', title: 'Suivi des statuts', text: 'Chaque étape est visible et son historique reste accessible.', className: 'feature-card--timeline' },
  { type: 'hl7', title: 'Messages HL7 générés', text: 'Les échanges de demande s’inscrivent dans le flux clinique existant.', className: 'feature-card--hl7' },
  { type: 'worklist', title: 'Worklist de modalité', text: 'Les informations d’acquisition suivent le parcours jusqu’à l’équipement.', className: 'feature-card--worklist' },
  { type: 'fhir', title: 'Ressources FHIR', text: 'Les ressources de demande et de compte rendu sont exposées pour le partage.', className: 'feature-card--fhir' },
  { type: 'audit', title: 'Journal d’audit', text: 'Les actions importantes disposent d’une trace consultable.', className: 'feature-card--audit' },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [activeStatus, setActiveStatus] = useState(0);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const heroImageRef = useRef(null);
  const destination = isAuthenticated ? '/dashboard' : '/login';

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealElements = document.querySelectorAll('[data-reveal]');
    let observer;

    if (reducedMotion) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
      setWorkflowProgress(1);
    } else if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.16, rootMargin: '0px 0px -4% 0px' });
      revealElements.forEach((element) => observer.observe(element));
    } else {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    }

    let frame = 0;
    const updateScrollEffects = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const scrollY = window.scrollY;
        setScrolled(scrollY > 24);
        if (!reducedMotion && heroImageRef.current) {
          heroImageRef.current.style.setProperty('--parallax-y', `${Math.min(scrollY * 0.15, 140)}px`);
        }
        const section = document.getElementById('parcours');
        if (section && !reducedMotion) {
          const bounds = section.getBoundingClientRect();
          const progress = Math.max(0, Math.min(1, (window.innerHeight * 0.58 - bounds.top) / bounds.height));
          setWorkflowProgress((current) => Math.abs(current - progress) > 0.012 ? progress : current);
        }
      });
    };

    const statusTimer = reducedMotion
      ? null
      : window.setInterval(() => setActiveStatus((current) => (current + 1) % statusExamples.length), 2400);
    window.addEventListener('scroll', updateScrollEffects, { passive: true });
    updateScrollEffects();

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', updateScrollEffects);
      if (statusTimer) window.clearInterval(statusTimer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activeStep = Math.min(workflow.length - 1, Math.floor(workflowProgress * workflow.length));

  return (
    <main className="landing-page">
      <header className={`landing-header${scrolled ? ' landing-header--scrolled' : ''}`}>
        <div className="landing-header__inner">
          <Link to="/" aria-label="RadioPlatform, accueil"><Brand /></Link>
          <nav className="landing-nav" aria-label="Navigation principale">
            <a href="#parcours">Parcours</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#interop">Interopérabilité</a>
          </nav>
          <Link className="button button--small button--outline" to={destination}>
            {isAuthenticated ? 'Ouvrir la plateforme' : 'Se connecter'}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-hero__media">
          <img ref={heroImageRef} src={heroImage} alt="" fetchPriority="high" />
        </div>
        <div className="landing-hero__veil" />
        <div className="landing-hero__content">
          <span className="eyebrow"><Sparkles aria-hidden="true" /> Le parcours d’imagerie, en un seul espace</span>
          <h1 id="hero-title">Suivez chaque examen, de la demande au compte rendu</h1>
          <p>Un seul parcours pour le médecin demandeur, le radiologue et le spécialiste : planifié, tracé et prêt à partager.</p>
          <div className="landing-hero__actions">
            <Link className="button button--primary" to={destination}>Se connecter <ArrowRight aria-hidden="true" /></Link>
            <a className="button button--secondary" href="#parcours">Voir le parcours <ArrowDown aria-hidden="true" /></a>
          </div>
        </div>
        <div className="hero-exam-card" aria-live="polite">
          <div className="hero-exam-card__top"><span>Exemple</span><span className="hero-exam-card__live"><i /> Parcours</span></div>
          <div className="hero-exam-card__body">
            <span className="hero-exam-card__icon"><Radio aria-hidden="true" /></span>
            <span><b>Examen radiologique</b><small>Demande suivie à chaque étape</small></span>
          </div>
          <div className={`hero-exam-status hero-exam-status--${statusExamples[activeStatus].tone}`}>
            <i /> {statusExamples[activeStatus].label}
          </div>
          <div className="hero-exam-card__steps" aria-hidden="true">
            {statusExamples.map((status, index) => <i className={index <= activeStatus ? 'is-complete' : ''} key={status.label} />)}
          </div>
        </div>
        <div className="landing-hero__scroll" aria-hidden="true"><span /> Défilez pour découvrir</div>
      </section>

      <section className="workflow-section section-shell" id="parcours" aria-labelledby="workflow-title">
        <div className="section-heading" data-reveal>
          <span className="eyebrow"><Activity aria-hidden="true" /> Un parcours continu</span>
          <h2 id="workflow-title">De la prescription au partage, sans rupture</h2>
          <p>Chaque intervenant retrouve le bon contexte au bon moment.</p>
        </div>
        <ol className="workflow-list" style={{ '--workflow-progress': `${workflowProgress * 100}%` }}>
          {workflow.map((step, index) => (
            <li
              className={`workflow-step${index === activeStep ? ' workflow-step--active' : ''}${index < activeStep ? ' workflow-step--done' : ''}${index > activeStep ? ' workflow-step--upcoming' : ''}`}
              data-reveal
              key={step.title}
              style={{ '--reveal-delay': `${index * 70}ms` }}
            >
              <span className="workflow-step__marker" aria-hidden="true">
                {index < activeStep ? <Check /> : <span>{String(index + 1).padStart(2, '0')}</span>}
              </span>
              <span className="workflow-step__content">
                <span className="workflow-step__meta">{step.tool}</span>
                <b>{step.title}</b>
                <span>{step.text}</span>
              </span>
              <span className="workflow-step__arrow" aria-hidden="true"><ArrowRight /></span>
            </li>
          ))}
        </ol>
      </section>

      <section className="features-section section-shell" id="fonctionnalites" aria-labelledby="features-title">
        <div className="section-heading section-heading--left" data-reveal>
          <span className="eyebrow"><CheckCircle2 aria-hidden="true" /> Une plateforme coordonnée</span>
          <h2 id="features-title">Les bons outils, au fil du parcours</h2>
          <p>Des fonctions pensées pour relier les équipes et les systèmes d’imagerie.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className={`feature-card ${feature.className}`} data-reveal key={feature.type}>
              <FeaturePreview type={feature.type} />
              <div className="feature-card__copy">
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
              <span className="feature-card__arrow" aria-hidden="true"><ArrowUpRight /></span>
            </article>
          ))}
        </div>
      </section>

      <section className="interop-section" id="interop" aria-labelledby="interop-title">
        <div className="section-shell interop-section__inner" data-reveal>
          <div>
            <span className="eyebrow"><ShieldCheck aria-hidden="true" /> Échanges interopérables</span>
            <h2 id="interop-title">Conçu pour dialoguer avec l’écosystème clinique</h2>
            <p>Des standards éprouvés pour accompagner les échanges entre systèmes et professionnels.</p>
          </div>
          <ul className="standards-list" aria-label="Standards intégrés">
            <li><span>HL7</span><small>v2</small></li>
            <li><span>FHIR</span><small>R4</small></li>
            <li><span>DICOM</span></li>
            <li><span>IHE</span><small>SWF.b</small></li>
          </ul>
        </div>
      </section>

      <section className="closing-section section-shell" data-reveal>
        <div className="closing-section__glow" />
        <div className="closing-section__content">
          <span className="eyebrow">RadioPlatform · Module 1</span>
          <h2>Prêt à suivre votre premier examen&nbsp;?</h2>
          <p>Retrouvez votre espace de travail et poursuivez le parcours clinique.</p>
          <Link className="button button--primary" to={destination}>Se connecter <ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="section-shell landing-footer__inner">
          <Link to="/" aria-label="RadioPlatform, accueil"><Brand /></Link>
          <span>Module 1 · SIH / RIS</span>
          <span>© {new Date().getFullYear()} RadioPlatform</span>
        </div>
      </footer>
    </main>
  );
}
