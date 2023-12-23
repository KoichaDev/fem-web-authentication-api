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

		// Credential Management API storage
		// ! This is false-positive, because in Safari browser, we do have navigator.credentials, but not for what we want.
		// ! Just for WebAuthn
		// ! if (navigator.credentials) {...}

		if (window.PasswordCredential && userPayload.password) {
			const credentials = new PasswordCredential({
				id: userPayload.email,
				name: userPayload.name,
				password: userPayload.password,
			});

			try {
				navigator.credentials.store(credentials);
			} catch (error) {
				console.error('error: ', error);
			}
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

		Auth.postLogin(response, userPayload);
	},
	login: async (event) => {
		if (event) {
			event.preventDefault();
		}

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
	autoLogin: async () => {
		if (window.PasswordCredential) {
			const credentials = await navigator.credentials.get({ password: true });

			// ! Remember, this solution is not going to work on Safari by using auto-retrieval when page loads
			// ! It only going to work on Chrome-based browser only
			document.getElementById('login_email').value = credentials.id;
			document.getElementById('login_password').value = credentials.password;

			Auth.login();

			console.log(credentials);
		}
	},
	logout() {
		Auth.isLoggedIn = false;
		Auth.account = null;
		Auth.updateStatus();

		Router.go('/');

		if (window.PasswordCredential) {
			// Next time you login, it will prevent auto-login.
			navigator.credentials.preventSilentAccess();
		}
	},
	loginFromGoogle: (data) => {
		console.log(data);
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
Auth.autoLogin();
Auth.updateStatus();

export default Auth;

// make it a global object
window.Auth = Auth;
