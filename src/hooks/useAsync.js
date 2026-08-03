'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 비동기 로드 상태 관리.
 *
 * @param {() => Promise<any>} fn   deps가 바뀌면 다시 실행
 * @param {any[]} deps
 * @param {{ skip?: boolean }} opts  skip이면 실행하지 않고 idle 상태 유지
 */
export function useAsync(fn, deps = [], opts = {}) {
  const { skip = false } = opts;
  const [state, setState] = useState({ data: null, error: null, loading: !skip });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (skip) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => {
        // 401은 api.js가 로그인으로 보내므로 화면에 에러를 띄우지 않는다.
        if (alive && error?.status !== 401) setState({ data: null, error, loading: false });
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skip, nonce]);

  return { ...state, reload };
}
