import Router from 'next/router'
import React from 'react'

import ListErrors from 'front/ListErrors'
import Label from 'front/Label'
import { webApi } from 'front/api'
import { LOGIN_ACTION, REGISTER_ACTION, useCtrlEnterSubmit, setCookie, setupUserLocalStorage } from 'front'

const LoginForm = ({ register = false }) => {
  const [isLoading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState([]);
  let email, setEmail;
  let displayName, setDisplayName;
  if (register) {
    [email, setEmail] = React.useState("");
    [displayName, setDisplayName] = React.useState("");
  }
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  let handleEmailChange, handleDisplayNameChange;
  if (register) {
    handleEmailChange = React.useCallback(
      (e) => setEmail(e.target.value),
      []
    );
    handleDisplayNameChange = React.useCallback(
      (e) => setDisplayName(e.target.value),
      []
    );
  }
  const handleUsernameChange = React.useCallback(
    (e) => setUsername(e.target.value),
    []
  );
  const handlePasswordChange = React.useCallback(
    (e) => setPassword(e.target.value),
    []
  );
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let data, status;
      if (register) {
        ({ data, status } = await webApi.userCreate({ displayName, username, email, password }));
      } else {
        ({ data, status } = await webApi.userLogin({ username, password }));
      }
      if (status !== 200 && data?.errors) {
        setErrors(data.errors);
      }
      if (data?.user) {
        await setupUserLocalStorage(data, setErrors)
        Router.back()
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  useCtrlEnterSubmit(handleSubmit)
  return (
    <>
      <ListErrors errors={errors} />
      <form onSubmit={handleSubmit}>
        {register &&
          <>
            <Label label="Display name">
              <input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={handleDisplayNameChange}
              />
            </Label>
          </>
        }
        <Label label={ register ? "Username (cannot be modified later)" : "Username or email" }>
          <input
            autoComplete="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={handleUsernameChange}
          />
        </Label>
        {register &&
          <>
            <Label label="Email">
              <input
                autoComplete="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={handleEmailChange}
              />
            </Label>
          </>
        }
        <Label label="Password">
          <input
            autoComplete={register ? "new-password" : "current-password"}
            type="password"
            placeholder="Password"
            value={password}
            onChange={handlePasswordChange}
          />
        </Label>
        <button
          className="btn"
          type="submit"
          disabled={isLoading}
        >
          {`${register ? REGISTER_ACTION : LOGIN_ACTION}`}
        </button>
      </form>
    </>
  );
};

export default LoginForm;
