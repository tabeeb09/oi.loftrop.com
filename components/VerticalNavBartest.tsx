"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from "react";
import "./VerticalNavBar.css";

interface TreeNode {
  id: string;
  name: string;
  type: "node" | "page" | "resource";
  children?: TreeNode[];
  isExpanded?: boolean;
  isPublic?: boolean;
  isEditor?: boolean;
}

interface PinnedSpace {
  id: string;
  name: string;
  root: TreeNode;
}

const INDENT_SIZE = 16;

interface VerticalNavBarProps {
  onExpandedChange?: (expanded: boolean) => void;
}


export default function VerticalNavBar(props: VerticalNavBarProps) {
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [pinnedSpaces, setPinnedSpaces] = useState<PinnedSpace[]>([]);
  const [selected, setSelected] = useState<{ spaceId: string; nodeId: string } | null>(null);
  // When a node is selected we keep track of both its immediate
  // parent (selectedParent) and the highest expanded ancestor into
  // which new children should be inserted (selectedAnchor).  The
  // selectedParent represents the parent of a leaf or the selected
  // directory itself, whereas selectedAnchor climbs up the ancestor
  // chain until it finds a node that is expanded (or the root) so
  // that helper actions appear at the bottom of the appropriate
  // subtree rather than directly underneath collapsed nodes.  See
  // handleSelect for details.
  const [selectedParent, setSelectedParent] = useState<{ spaceId: string; nodeId: string } | null>(null);
  const [selectedAnchor, setSelectedAnchor] = useState<{ spaceId: string; nodeId: string } | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const newSpaceInputRef = useRef<HTMLInputElement | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [marqueeId, setMarqueeId] = useState<{ spaceId: string; nodeId: string } | null>(null);
  const [createAction, setCreateAction] = useState<
    | {
        type: "child" | "page" | "resource";
        spaceId: string;
        nodeId: string;
        depth: number;
      }
    | null
  >(null);
  const [actionValue, setActionValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [contextMenu, setContextMenu] = useState<
    | {
        x: number;
        y: number;
        spaceId: string;
        nodeId: string;
      }
    | null
  >(null);


function toggleCollapsed() {
  setCollapsed(prev => {
    const next = !prev;
    if (next) setProfileExpanded(false); // closing nav
    return next;
  });
}



useEffect(() => {
  const expanded = !collapsed;
  console.log("NAV expanded:", expanded);
  if (expanded) {
    requestAnimationFrame(() => {
      const appMain = document.querySelector(".app-container") as HTMLElement | null;
      const page = document.scrollingElement as HTMLElement | null;

      // Use app-main only if it actually overflows horizontally; otherwise use page
      const scroller =
        appMain && appMain.scrollWidth > appMain.clientWidth ? appMain : page;

      const X = 100;

      if (!scroller) return;

      const maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const clamped = Math.min(X, maxX);

      console.log("SCROLLER DEBUG", {
        tag: scroller.tagName,
        className: scroller.className,
        clientWidth: scroller.clientWidth,
        scrollWidth: scroller.scrollWidth,
        maxX,
        clamped,
      });

      scroller.scrollLeft = clamped;

      if (scroller === document.scrollingElement) {
        window.scrollTo({ left: clamped, top: window.scrollY });
      }
    });
  }

  props.onExpandedChange?.(expanded);
}, [collapsed, props.onExpandedChange]);

  return (
    <nav
      className={`nav-container${collapsed ? ' nav-collapsed' : ''}`}
      onClick={() => {
        // Hide context menu when clicking anywhere in the nav bar
        if (contextMenu) hideContextMenu();
      }}
    >
      <div className="nav-top">
        <button
          className="nav-hamburger"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span></span>
        </button>
        {!collapsed && 
            <span style={{ marginRight: '0.05rem',  fontSize: '1.5rem', fontWeight: 'bold' }}>Menu</span>} 
      </div>
      {collapsed && (
        <div className="nav-collapsed-bar" aria-hidden={false}>
          <button
            className="nav-collapsed-button"
            onClick={() => {
              setCollapsed(false);
              setProfileExpanded(true);
            }}
            aria-label="Open sidebar"
          >
            <img
              src="/icons/portfolio-icon.svg"
              className="nav-collapsed-icon"
              alt="portfolio"
              style={{ width: 'var(--collapsed-icon-size,24px)', height: 'var(--collapsed-icon-size,24px)' }}
            />
          </button>
        </div>
      )}
      {!collapsed && (
        <>
          <div className="nav-content" style ={{ '--row-vertical-spacing': '0.0025rem' } as React.CSSProperties}>
            
            <div className="nav-profile">
                <div
                  className="nav-profile-header"
                  onClick={() => setProfileExpanded(!profileExpanded)}
                >
                  {/* Profile header shows the user identifier without a wand icon. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img className="nav-home-icon" src="/icons/portfolio-icon.svg" alt="home icon" style={{ width: 'var(--home-icon-size, 40px)', height: 'var(--home-icon-size, 40px)' }}/>
                    
                  </div>
                  <span className="nav-node-name" style={{ flex: 1, paddingLeft: '0.5rem', fontSize: '1.25rem' , fontWeight: 'bold' }}>
                    Portfolio
                  </span>
                  <span>{profileExpanded ? '▼' : '▶'}</span>
                  </div>
                  {profileExpanded && (
                    <div className="nav-profile-sub">
                      <a href="/climate_data_analysis" onClick={e => { /* stub */ }}>Climate Change Data Science</a>
                      <a href="/hhg" onClick={e => { /* stub */ }}>UCL Attosecond Particle Physics Research Project</a> 
                      <a href="/collaborators" onClick={e => { /* stub */ }}>Web Development</a>
                      <a href="/collaborators" onClick={e => { /* stub */ }}>Memristors & Spiking Neural Nets</a>
                      <a href="/agentic" onClick={e => { /* stub */ }}>Agentic Web Automation</a>
                    </div>
                  )}
               {/**  <a href="/collaborators" onClick={e => { /* stub */ /** }}>Neural networks in general</a>
                      <a href="/collaborators" onClick={e => { /* stub */ /**}}>Newton solutions</a>
                      <a href="/collaborators" onClick={e => { /* stub */ /**}}>Math puzzle solutions</a>
                      <a href="/collaborators" onClick={e => { /* stub */ /**}}>LLMs</a>
                      <a href="/collaboratores" onClick={e => { /* stub */ /**}}>Algorithmic trading</a>
                      <a href="/spaces" onClick={e => { /* stub *//** }}>3D Physics Engine</a>
                      <a href="/premium" onClick={e => { /* stub */ /**}}>CNN from first principles</a>*/}
            </div>
            {/** <a href="/search" className="nav-search-link" onClick={e => {  stub  }}>
              <span className="icon-search"></span>
              <span className="nav-node-name" style={{ marginLeft: '0.5rem' }}>Search</span>
            </a> */ }
            {/* <div className="nav-cas-panel">
              <div className="nav-cas-title">Current Active Spaces</div>
              <div className="nav-cas-list">
                {pinnedSpaces.length === 0 && (
                  <div className="nav-node" style={{ fontSize: '0.75rem', color: '#90a7d5ff' }}>
                    No spaces pinned.
                  </div>
                )}
                {pinnedSpaces.map(space => (
                  <div key={space.id} className="nav-space">
                    {renderTreeNode(space, space.root, 0, true)}
                  </div>
                ))}
              </div>
              <div className="nav-create-row" style={{ marginLeft: '0', padding: '0.5rem 0.75rem' }}>
                {!isCreatingSpace ? (
                  <button
                    className="nav-add-action-button"
                    onClick={handleCreateSpaceClick}
                  >
                    <span style={{ marginRight: '0.25rem' }}></span>
                    Create New User Space
                  </button>
                <div className="nav-profile-header">
                  <button
                    type="button"
                    className="nav-profile-toggle"
                    aria-expanded={profileExpanded}
                    onClick={e => {
                      e.stopPropagation();
                      setProfileExpanded(prev => !prev);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      className="nav-home-icon"
                      src="/icons/portfolio-icon.svg"
                      alt="portfolio"
                      style={{ width: 'var(--home-icon-size, 40px)', height: 'var(--home-icon-size, 40px)', flex: '0 0 auto' }}
                    />
                    <span className="nav-node-name" style={{ flex: 1 }}>
                      Portfolio
                    </span>
                    <span aria-hidden className="nav-profile-indicator">
                      {profileExpanded ? '▼' : '▶'}
                    </span>
                  </button>
                </div>
                        setIsCreatingSpace(false);
                        setNewSpaceName('');
                      }}
                      placeholder="Space name"
                    />
                    <div className="nav-create-buttons">
                      <button className="nav-create-add" onClick={confirmNewSpace}>
                        Add
                      </button>
                      <button
                        className="nav-create-cancel"
                        onClick={() => {
                          setIsCreatingSpace(false);
                          setNewSpaceName('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div> 
            </div>*/}
          </div>
          {/* {session && (
            <div className="nav-signout">
              <SignOutButton />
            </div>
          )} */}
        </>
      )}
      {/* <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
      {tooltip && (
        <div className="nav-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          {tooltip.text}
        </div>
      )} */}

      {/* Right-click context menu for collaborator actions.  This menu
          appears near the cursor when a node is right-clicked and
          provides options to add collaborators. */}
      {/* {contextMenu && (
        <div
          className="nav-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="nav-context-item"
            onClick={() => {
              addCollaboratorGroup(contextMenu.spaceId, contextMenu.nodeId);
              hideContextMenu();
            }}
          >
            Add collaborator group
          </button>
          <button
            className="nav-context-item"
            onClick={() => {
              addCollaborator(contextMenu.spaceId, contextMenu.nodeId);
              hideContextMenu();
            }}
          >
            Add collaborator
          </button>
        </div>
      )} */}
    </nav>
  );
}
