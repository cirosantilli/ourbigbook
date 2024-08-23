import React from 'react'

import CustomLink from 'front/CustomLink'
import LoginForm from 'front/LoginForm'
import routes from 'front/routes'
import {
  LOGIN_ACTION,
  MyHead,
  REGISTER_ACTION,
  UserIcon,
} from 'front'

import { CommonPropsType } from 'front/types/CommonPropsType'

export interface LoginPageProps extends CommonPropsType {}

const LoginPageHoc = ({ register = false }) => {
  const title = register ? REGISTER_ACTION : LOGIN_ACTION
  return function LoginPage() {
    return <>
      <MyHead title={title} />
      <div className="auth-page content-not-ourbigbook">
        <h1 className="text-xs-center"><UserIcon /> {title}</h1>
        <CustomLink href={register ? routes.userLogin() : routes.userNew()} >
          {`${register ? `Already have an account? ${LOGIN_ACTION} here.` : `Don't have an account? ${REGISTER_ACTION} here.` }`}
        </CustomLink>
        <LoginForm register={register} />
      </div>
    </>
  }
}

export default LoginPageHoc;
