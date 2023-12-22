import API from './API.js';
import Router from './Router.js';

const Auth = {
	isLoggedIn: false,
	account: null,
	postLogin: async (response, userPayload) => {
		if (response.ok) {
			Auth.isLoggedIn = true;
			Auth.account = userPayload;
			Auth.updateStatus();
			Router.go('/account');
		} else {
			alert(response.message);
		}
	},
	register: async (event) => {
		event.preventDefault();

		const userPayload = {
			name: document.getElementById('register_name').value,
			email: document.getElementById('register_email').value,
			password: document.getElementById('register_password').value,
		};

		const response = await API.register(userPayload);

		Auth.postLogin(response, {
			name: userPayload.name,
			email: userPayload.email,
		});
	},
	login: async (event) => {
		event.preventDefault();

		const credentialsPayload = {
			email: document.getElementById('login_email').value,
			password: document.getElementById('login_password').value,
		};

		const response = await API.login(credentialsPayload);

		Auth.postLogin(response, {
			...credentialsPayload,
			name: response.name,
		});
	},
	logout() {
		Auth.isLoggedIn = false;
		Auth.account = null;
		Auth.updateStatus();

		Router.go('/');
	},
	updateStatus() {
		if (Auth.isLoggedIn && Auth.account) {
			document.querySelectorAll('.logged_out').forEach((e) => (e.style.display = 'none'));
			document.querySelectorAll('.logged_in').forEach((e) => (e.style.display = 'block'));
			document.querySelectorAll('.account_name').forEach((e) => (e.innerHTML = Auth.account.name));
			document.querySelectorAll('.account_username').forEach((e) => (e.innerHTML = Auth.account.email));
		} else {
			document.querySelectorAll('.logged_out').forEach((e) => (e.style.display = 'block'));
			document.querySelectorAll('.logged_in').forEach((e) => (e.style.display = 'none'));
		}
	},
	init: () => {},
};
Auth.updateStatus();

export default Auth;

// make it a global object
window.Auth = Auth;
