import React from 'react';

export default function PageHeader({ eyebrow, title, description, icon: Icon, actions }) {
  return (
    <header className="app-page-header">
      <div className="app-page-header__identity">
        {Icon && <span className="app-page-header__icon"><Icon aria-hidden="true" /></span>}
        <div className="min-w-0">
          <p className="app-page-header__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="app-page-header__description">{description}</p>}
        </div>
      </div>
      {actions && <div className="app-page-header__actions">{actions}</div>}
    </header>
  );
}
