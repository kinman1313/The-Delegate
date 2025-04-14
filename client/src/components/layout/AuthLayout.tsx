// src/components/layout/AuthLayout.tsx
import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title }) => {
    return (
        <div className= "auth-container" >
                <div className="auth-form-container" >
                    <h1>{ title } < /h1>
                { children }
                </div>
            < /div>
    );
};

export default AuthLayout;