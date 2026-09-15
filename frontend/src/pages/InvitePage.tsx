import { FormEvent, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ApiError, authApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function InvitePage() {
  const { token = "" } = useParams();
  const { user, refresh } = useAuth();
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The CSRF cookie has to exist before the accept POST goes out.
    authApi
      .csrf()
      .then(() => authApi.invitationInfo(token))
      .then((info) => {
        if (!cancelled) setHouseholdName(info.household_name);
      })
      .catch((err) => {
        if (cancelled) return;
        // A 404 is the generic "not found" copy, which reads like a system
        // error here. Anything else already carries a specific reason.
        if (err instanceof ApiError && err.status === 404) {
          setLoadError("この招待リンクは存在しません");
        } else {
          setLoadError(
            err instanceof Error ? err.message : "この招待リンクは使えません"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (user && !accepted) {
    return <Navigate to="/" replace />;
  }
  if (accepted) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authApi.acceptInvitation(token, { username, password });
      await refresh();
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録できませんでした");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="login-page">
        <div className="login-panel">
          <h1>招待を確認できません</h1>
          <div className="error-message">{loadError}</div>
          <p className="invite-note">
            招待した人にリンクを再発行してもらってください。
          </p>
        </div>
      </div>
    );
  }

  if (householdName === null) {
    return <div className="loading">読み込み中...</div>;
  }

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <h1>{householdName}に参加</h1>
        <p className="invite-note">
          この世帯の資産を一緒に管理するアカウントを作ります。
        </p>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <label htmlFor="username">ユーザー名</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className="field-hint">12文字以上で設定してください。</p>
        </div>
        <button
          className="btn btn-primary login-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "登録中..." : "参加する"}
        </button>
      </form>
    </div>
  );
}
