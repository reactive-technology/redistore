declare const userKeys: {
    id: string;
    name: string;
    description: string;
    version: string;
    expiresIn: string;
}[];
declare const applicationKeys: {
    id: string;
    name: string;
    description: string;
    version: string;
    expiresIn: string;
}[];
declare const admin_users_auth_strategy = "jwt-admin-users-webedia";
declare const settings: {
    jwtPrivateKey: string;
    app_webedia_auth_strategy: string;
    admin_users_auth_strategy: string;
    admin_authentication: {
        strategy: string;
        scope: string[];
    };
    jwtCookieName: string;
    jwtVerifyOptions: {
        algorithm: string;
        expiresIn: string;
    };
};
