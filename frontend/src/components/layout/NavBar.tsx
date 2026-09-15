import { ChartLineIcon } from "@phosphor-icons/react/dist/csr/ChartLine";
import { CurrencyJpyIcon } from "@phosphor-icons/react/dist/csr/CurrencyJpy";
import { NotePencilIcon } from "@phosphor-icons/react/dist/csr/NotePencil";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand" aria-label="わが家の資産">
          わが家の資産
        </NavLink>
        {user && (
          <>
            <nav className="navbar-links" aria-label="主要な画面">
              <NavLink to="/" end>
                <CurrencyJpyIcon
                  className="navbar-link-icon"
                  size={17}
                  weight="regular"
                  aria-hidden="true"
                />
                総資産
              </NavLink>
              <NavLink to="/assets">
                <WalletIcon
                  className="navbar-link-icon"
                  size={17}
                  weight="regular"
                  aria-hidden="true"
                />
                資産管理
              </NavLink>
              <NavLink to="/snapshots">
                <NotePencilIcon
                  className="navbar-link-icon"
                  size={17}
                  weight="regular"
                  aria-hidden="true"
                />
                残高入力
              </NavLink>
              <NavLink to="/charts">
                <ChartLineIcon
                  className="navbar-link-icon"
                  size={17}
                  weight="regular"
                  aria-hidden="true"
                />
                資産推移
              </NavLink>
            </nav>
            <div className="navbar-account">
              <span className="navbar-username">{user.username}</span>
              <button className="navbar-logout" type="button" onClick={logout}>
                ログアウト
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
