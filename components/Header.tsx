
"use client";

import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import "./VerticalNavBar.css";
import HeaderButton from "./HeaderButton";

export default function Header() {
  const { data: session, status } = useSession();
  
  return (
    <header className="app-header" style={{ height: 'var(--header-height)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="header-inner" style={{ height: '100%' }}>
        <div className="header-left">
          <a href="/" className="nav-home-link"  style={{ paddingLeft: '0rem' }} onClick={e => { /* stub */ }}>
            <img className="nav-home-icon" src="/icons/home-icon.svg" alt="home icon" style={{ width: 'var(--home-icon-size, 40px)', height: 'var(--home-icon-size, 40px)' }}/>
          </a>
        </div>
        <div className="header-left">
          <h1 className="header-title" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Tabeeb Rahman</h1>
        </div>
        <div className="header-right" style={{marginRight: '0.75rem', gap: '0.5rem'}}>
          <HeaderButton href="https://www.linkedin.com/" variant="outline-primary" className="header-btn" >
            <b>Hire me</b>
          </HeaderButton>
          {status === "loading" ? null : session ? (
            <HeaderButton
              variant="outline-secondary"
              className="header-btn"
              onClick={() => signOut()}
            >
              Sign out
            </HeaderButton>
          ) : (
            <HeaderButton
              href="/api/auth/signin"
              variant="outline-secondary"
              className="header-btn"
            >
              Sign in
            </HeaderButton>
          )}
          <HeaderButton href="/docs" variant="outline-dark" className="header-btn">
            <b>Docs</b>
          </HeaderButton>
        </div>
      </div>
    </header>
  );
}



