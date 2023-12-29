const API = {
	endpoint: '/auth/',
	login: async (userPayload) => {
		return await API.makePostRequest(API.endpoint + 'login', userPayload);
	},
	checkAuthOptions: async (userPayload) => {
		return await API.makePostRequest(API.endpoint + 'auth-options', userPayload);
	},
	register: async (userPayload) => {
		return await API.makePostRequest(API.endpoint + 'register', userPayload);
	},
	loginFromGoogle: async (credentialPayload) => {
		return await API.makePostRequest(API.endpoint + 'login-google', credentialPayload);
	},
	webAuthn: {
		loginOptions: async (email) => {
			return await API.makePostRequest(API.endpoint + 'webauth-login-options', { email });
		},
		loginVerification: async (email, data) => {
			return await API.makePostRequest(API.endpoint + 'webauth-login-verification', {
				email,
				data,
			});
		},
		registrationOptions: async () => {
			return await API.makePostRequest(API.endpoint + 'webauth-registration-options', Auth.account);
		},
		registrationVerification: async (data) => {
			return await API.makePostRequest(API.endpoint + 'webauth-registration-verification', {
				user: Auth.account,
				data,
			});
		},
	},
	// ADD HERE ALL THE OTHER API FUNCTIONS
	makePostRequest: async (url, data) => {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});
		return await response.json();
	},
};

export default API;
