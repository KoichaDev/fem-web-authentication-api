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

app.get('*', (req, res) => {
	res.sendFile(__dirname + 'public/index.html');
});

app.listen(port, () => {
	console.log(`App listening on port ${port}`);
});
