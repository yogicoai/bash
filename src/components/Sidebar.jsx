'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { GROUPS } from '@/lib/links';
import { useEmbed } from './EmbedModal';
import { resolveHref } from '@/lib/zones';

export default function Sidebar() {
  const pathname = usePathname();
  const { open } = useEmbed();
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => setMe(j.id))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="sidebar">
      <Link href="/" className="sb-brand">
        {/* 로고가 검정 단색이라 레퍼런스처럼 흰 박스 위에 얹는다 */}
        <span className="sb-logo-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="YOGI CORPORATION" />
        </span>
        <span className="sb-brand-text">
          요기코퍼레이션
          <small>통합 대시보드</small>
        </span>
      </Link>

      <nav className="sb-nav">
        {GROUPS.map((group) => (
          <div className="sb-group" key={group.id}>
            <div className="sb-group-label">{group.title}</div>
            {group.items.map((item) => {
              if (item.status === 'planned') {
                return (
                  <span className="sb-item sb-item-planned" key={item.name} title="준비 중">
                    <span className="sb-ic">{item.icon}</span>
                    <span className="sb-label">{item.name}</span>
                    <span className="sb-tag">예정</span>
                  </span>
                );
              }

              // 외부 화면은 팝업(iframe)으로 — 사이드바를 유지한 채 위에 띄운다
              if (item.slug) {
                return (
                  <button type="button" className="sb-item" key={item.name} onClick={() => open({ ...item, href: resolveHref(item) })}>
                    <span className="sb-ic">{item.icon}</span>
                    <span className="sb-label">{item.name}</span>
                    <span className="sb-ext" title="팝업으로 열림">⧉</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`sb-item ${pathname === item.href ? 'active' : ''}`}
                >
                  <span className="sb-ic">{item.icon}</span>
                  <span className="sb-label">{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        {me && <span className="sb-me" title={`${me} 님으로 로그인`}>{me}</span>}
        <button type="button" className="sb-logout" onClick={logout}>
          로그아웃
        </button>
      </div>
    </aside>
  );
}
