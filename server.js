import express from 'express';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import * as url from 'url';
import bcrypt from 'bcryptjs';
import * as jwtJsDecode from 'jwt-js-decode';
import base64url from 'base64url';
import SimpleWebAuthnServer from '@simplewebauthn/server';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const app = express();
app.use(express.json());

const adapter = new JSONFile(__dirname + '/auth.json');
const db = new Low(adapter);
await db.read();
db.data ||= { users: [] };

const rpID = 'localhost';
const protocol = 'http';
const port = 5050;
const expectedOrigin = `${protocol}://${rpID}:${port}`;

app.use(express.static('public'));
app.use(express.json());
app.use(
	express.urlencoded({
		extended: true,
	})
);

function findUser(email) {
	const results = db.data.users.filter((user) => user.email === email);

	if (results.length === 0) return;

	return results[0];
}

app.post('/auth/auth-options', (req, res) => {
	const foundUser = findUser(req.body.email);

	if (foundUser) {
		res.send({
			password: foundUser.password !== false,
			google: foundUser.federated && foundUser.federated.google,
			webAuthn: foundUser.webauthn,
		});
	} else {
		res.send({ password: true });
	}
});

// ADD HERE THE REST OF THE ENDPOINTS
app.post('/auth/login-google', (req, res) => {
	// The credential is coming from the Google settings data property
	let jwt = jwtJsDecode.decode(req.body.credential);

	let user = {
		email: jwt.payload.email,
		name: jwt.payload.given_name + ' ' + jwt.payload.family_name,
		password: null,
	};

	const userFound = findUser(user.email);

	if (userFound) {
		user.federated = {
			google: jwt.payload.aud,
		};
		db.write();
		res.send({ ok: true, name: user.name, email: user.email });
	} else {
		db.data.users.push({
			...user,
			federated: {
				google: jwt.payload.aud,
			},
		});

		db.write();
		res.send({ ok: true, name: user.name, email: user.email });
	}
});

app.post('/auth/login', (req, res) => {
	const userFound = findUser(req.body.email);

	if (userFound) {
		const isComparedPassword = bcrypt.compareSync(req.body.password, userFound.password);
		// User Found, check password
		if (isComparedPassword) {
			res.send({ ok: true, name: userFound.name, email: userFound.email });
		} else {
			res.sendStatus({
				ok: false,
				message: 'Credential are wrong',
			});
		}
	} else {
		// User Not Found
		res.sendStatus({
			ok: false,
			message: 'Credential are wrong',
		});
	}
});

app.post('/auth/register', (req, res) => {
	const plainTextPassword = req.body.password;
	// 10 has to do with random numbers
	const salt = bcrypt.genSaltSync(10);
	const hashedPassword = bcrypt.hashSync(plainTextPassword, salt);

	// TODO: Data validation such as password check, email etc.

	const user = {
		name: req.body.name,
		email: req.body.email,
		password: hashedPassword,
	};

	const userFound = findUser(user.email);

	if (userFound) {
		// User already exists
		res.send({
			ok: false,
			message: 'User already exists',
		});
	} else {
		// User is new, we are good!
		db.data.users.push(user);
		db.write();
		res.send({ ok: true });
	}
});

// WEBAUTHN ENDPOINTS

app.post('/auth/webauth-registration-options', (req, res) => {
	const user = findUser(req.body.email);

	// RP =  Reliant Party (which is us!)
	const options = {
		rpName: 'Coffee Masters',
		rpID,
		userID: user.email,
		userName: user.name,
		timeout: 60000, // How long the user will finish the operation of steps attestation/authentication
		attestationType: 'none',

		/**
		 * Passing in a user's list of already-registered authenticator IDs here prevents users from
		 * registering the same device multiple times. The authenticator will simply throw an error in
		 * the browser if it's asked to perform registration when one of these ID's already resides
		 * on it.
		 */
		excludeCredentials: user.devices
			? user.devices.map((dev) => ({
					id: dev.credentialID,
					type: 'public-key',
					transports: dev.transports,
			  }))
			: [],

		// This settings is default in the browser. You can remove the authenticatorSelection object if it's desirable
		authenticatorSelection: {
			userVerification: 'required',
			residentKey: 'required',
		},
		/**
		 * The two most common algorithms: ES256, and RS256
		 */
		supportedAlgorithmIDs: [-7, -257],
	};

	/**
	 * The server needs to temporarily remember this value for verification, so don't lose it until
	 * after you verify an authenticator response.
	 */
	const regOptions = SimpleWebAuthnServer.generateRegistrationOptions(options);
	// ! this is for verification to avoid security issues, and we want to save it to the database
	user.currentChallenge = regOptions.challenge;
	db.write();

	res.send(regOptions);
});

// after the user has clicked on the end-point /auth/webauth-registration-options
// then we want to move to this end-point, which we need to verify that everything looks OK, and no one has changed
// the data, no man in the middle attack has added, or changed the user information
app.post('/auth/webauth-registration-verification', async (req, res) => {
	const user = findUser(req.body.user.email);
	const data = req.body.data;

	const expectedChallenge = user.currentChallenge;

	let verification;
	try {
		const options = {
			credential: data,
			expectedChallenge: `${expectedChallenge}`,
			expectedOrigin,
			expectedRPID: rpID,
			requireUserVerification: true,
		};

		// here we need to verify the challenge after the end-point /auth/webauth-registration-options has triggeredq
		verification = await SimpleWebAuthnServer.verifyRegistrationResponse(options);
	} catch (error) {
		console.log(error);
		return res.status(400).send({ error: error.toString() });
	}

	const { verified, registrationInfo } = verification;

	if (verified && registrationInfo) {
		const { credentialPublicKey, credentialID, counter } = registrationInfo;

		const existingDevice = user.devices
			? user.devices.find((device) => new Buffer(device.credentialID.data).equals(credentialID))
			: false;

		if (!existingDevice) {
			const newDevice = {
				credentialPublicKey,
				credentialID,
				counter,
				transports: data.response.transports,
			};
			if (user.devices == undefined) {
				user.devices = [];
			}
			user.webauthn = true;
			user.devices.push(newDevice);
			db.write();
		}
	}

	res.send({ ok: true });
});

app.get('*', (req, res) => {
	res.sendFile(__dirname + 'public/index.html');
});

app.listen(port, () => {
	console.log(`App listening on port ${port}`);
});
