import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import SEO from "./SEO.js";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutInfo, setLockoutInfo] = useState(null); // { locked, remainingMinutes, remainingAttempts }

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Get redirect path from location state (e.g., from checkout)
  const from = location.state?.from?.pathname || "/";

  const validateForm = () => {
    if (!email || !password) {
      setError("Email and password are required");
      return false;
    }

    if (!isLogin) {
      if (!name) {
        setError("Name is required");
        return false;
      }
      if (password.length < 12 || password.length > 128 ||
          !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        setError("Password must be 12–128 characters with uppercase, lowercase and a number");
        return false;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLockoutInfo(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(email, password);
      } else {
        result = await register(email, password, name);
      }

      if (result.success) {
        // Redirect to the page they were trying to access, or home
        navigate(from, { replace: true });
      } else {
        setError(result.error || "Authentication failed");
        // Handle lockout info from backend
        if (
          result.locked !== undefined ||
          result.remainingAttempts !== undefined
        ) {
          setLockoutInfo({
            locked: result.locked,
            remainingMinutes: result.remainingMinutes,
            remainingAttempts: result.remainingAttempts,
          });
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setLockoutInfo(null);
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <SEO title={isLogin ? "Login" : "Register"} />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              {isLogin ? "Sign in to your account" : "Create new account"}
            </h2>
            {from !== "/" && (
              <p className="mt-2 text-center text-sm text-gray-600">
                Please sign in to continue to checkout
              </p>
            )}
          </div>

          {error && (
            <div
              className={`border px-4 py-3 rounded relative ${
                lockoutInfo?.locked
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <p className="font-medium">{error}</p>
              {lockoutInfo &&
                !lockoutInfo.locked &&
                lockoutInfo.remainingAttempts !== undefined && (
                  <p className="text-sm mt-1">
                    Attempts remaining: {lockoutInfo.remainingAttempts}
                  </p>
                )}
              {lockoutInfo?.locked && lockoutInfo.remainingMinutes && (
                <p className="text-sm mt-1">
                  Account will unlock in {lockoutInfo.remainingMinutes}{" "}
                  minute(s)
                </p>
              )}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              {!isLogin && (
                <div className="mb-4">
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={!isLogin}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="********"
                />
                {!isLogin && (
                  <p className="mt-1 text-xs text-gray-500">
                    Use at least 12 characters with uppercase, lowercase and a number.
                  </p>
                )}
              </div>

              {!isLogin && (
                <div className="mb-4">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required={!isLogin}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="********"
                  />
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <span>{isLogin ? "Sign in" : "Create account"}</span>
                )}
              </button>
            </div>
          </form>

          <div className="text-center">
            <button
              onClick={switchMode}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              {isLogin
                ? "Don't have an account? Register"
                : "Already have an account? Sign in"}
            </button>
          </div>

          <div className="text-center mt-4">
            <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
