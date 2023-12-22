const API = {
	endpoint: '/auth/',
	login: async (userPayload) => {
		return await API.makePostRequest(API.endpoint + 'login', userPayload);
	},
	register: async (userPayload) => {
		return await API.makePostRequest(API.endpoint + 'register', userPayload);
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
