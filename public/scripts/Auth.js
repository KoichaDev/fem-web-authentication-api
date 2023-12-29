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

	// This code is the flow from the WebAuthn on the slide 66 https://firtman.github.io/authentication/slides.pdf
	addWebAuthn: async () => {
		// 1. Waiting for the server to send us all that information
		const serverOptions = await API.webAuthn.registrationOptions();

		serverOptions.authenticatorSelection.residentKey = 'required';
		serverOptions.authenticatorSelection.requireResidentKey = true;
		serverOptions.extensions = {
			credProps: true,
		};

		// 2. We need to send the "options" object back to the server to verify,
		const authResponse = await SimpleWebAuthnBrowser.startRegistration(serverOptions);
		const verificationResponse = await API.webAuthn.registrationVerification(authResponse);

		if (verificationResponse.ok) {
			alert('You can now login with WebAuthn');
		} else {
			alert(verificationResponse.message);
		}
	},
	webAuthnLogin: async () => {
		const email = document.getElementById('login_email').value;

		const options = await API.webAuthn.loginOptions(email);
		const loginResponse = await SimpleWebAuthnBrowser.startAuthentication(options);
		const verificationResponse = await API.webAuthn.loginVerification(email, loginResponse);

		if (verificationResponse.ok) {
			Auth.postLogin(verificationResponse, verificationResponse.user);
		} else {
			alert(verificationResponse.message);
		}
	},
	login: async (event) => {
		if (event) {
			event.preventDefault();
		}

		if (Auth.loginStep === 1) {
			// We need to ask the server which options we have to log in the user
			// We have Google Password, and also Face ID, so then we can render different parts of the multi-step 2
			// based on what the server says

			Auth.checkAuthOptions();
		} else {
			// Multi-Step 2
			const credentialsPayload = {
				email: document.getElementById('login_email').value,
				password: document.getElementById('login_password').value,
			};

			const response = await API.login(credentialsPayload);

			Auth.postLogin(response, {
				...credentialsPayload,
				name: response.name,
			});
		}
	},
	checkAuthOptions: async () => {
		// TODO validate every entry before sending the code into production

		const response = await API.checkAuthOptions({
			email: document.getElementById('login_email').value,
		});

		Auth.loginStep = 2;

		if (response.password) {
			document.getElementById('login_section_password').hidden = false;
		}

		if (response.webAuthn) {
			document.getElementById('login_section_webauthn').hidden = false;
		}
	},
	autoLogin: async () => {
		if (window.PasswordCredential) {
			const credentials = await navigator.credentials.get({ password: true });

			if (credentials) {
				// ! Remember, this solution is not going to work on Safari by using auto-retrieval when page loads
				// ! It only going to work on Chrome-based browser only
				document.getElementById('login_email').value = credentials.id;
				document.getElementById('login_password').value = credentials.password;

				Auth.login();

				console.log(credentials);
			}
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
	loginFromGoogle: async (dataPayload) => {
		const response = await API.loginFromGoogle(dataPayload);

		Auth.postLogin(response, {
			name: response.name,
			email: response.email,
		});
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

	loginStep: 1,
	init: () => {
		document.getElementById('login_section_password').hidden = true;
		document.getElementById('login_section_webauthn').hidden = true;
	},
};
Auth.autoLogin();
Auth.updateStatus();

export default Auth;

// make it a global object
window.Auth = Auth;
