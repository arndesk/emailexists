const dns = require('dns');
const net = require('net');
const emailValidator = require('email-validator');
const awaitdelay = require('@arndesk/awaitdelay');
const os = require('os');

const getServerIPs = async () => {
	let serverIPs = [];

	const networkInterfaces = os.networkInterfaces();
	for (let interfaceName in networkInterfaces) {
		for (let interface of networkInterfaces[interfaceName]) {
			if (!interface.internal && interface.family === 'IPv4') {
				serverIPs.push(interface.address);
			}
		}
	}

	return serverIPs;
};

const validateHostname = async () => {
    dns.setServers(['1.1.1.1', '8.8.8.8']);

    let serverIPs = await getServerIPs();
    let publicIP = serverIPs[0]; // considering the first IP as the public one
    let validHostnames = [];

    try {
		let reversePromise = dns.promises.reverse(publicIP);
        let reverseResult = await awaitdelay(reversePromise, { timeout: 5000 });

        if (reverseResult.length > 0) {
            for (let hostname of reverseResult) {
				let lookupPromise = dns.promises.resolve4(hostname);
                let lookupResult = await awaitdelay(lookupPromise, { timeout: 5000 });

                if (lookupResult.includes(publicIP)) {
                    console.log(`${hostname} is valid and resolves to this server's IP.`);
                    validHostnames.push(hostname);
                } else {
                    console.log(`${hostname} is invalid as it does not resolve to this server's IP.`);
                }
            }

            if (validHostnames.length === 0) {
                console.log(`No valid RDNS found.`);
                process.exit(1);
            }

            return validHostnames; // Return the array of valid hostnames

        } else {
            console.log(`${publicIP} has no RDNS.`);
            process.exit(1);
        }
    } catch (error) {
        console.log(`Failed to validate ${publicIP}: ${error}`);
        process.exit(1);
    }
};

const sendAndLog = (socket, message) => {
	socket.write(message);
};

module.exports = {
	validateEmail: async (sender, recipient, checkValid) => {
		let hostnames;
		try {
			hostnames = await validateHostname();
		} catch (error) {
			throw error;
		}

		let addresses = null;
		let firstAddress = null;
		let validationResults = null;
		let timeoutError = null;
		let formatCheckError = null;
		let mxCheckError = null;
		let validCheckError = null;

		try {
			// Email Format Check- -- - - - -
			const formatCheck = new Promise((resolve, reject) => {
				if (emailValidator.validate(recipient)) {
					resolve(true);
				} else {
					reject('Invalid recipient format');
				}
			});

			try {
				if (!(await awaitdelay(formatCheck, { timeout: 5000 }) ) ) {
					formatCheckError = 'Invalid recipient format';
				}
			} catch (error) {
				formatCheckError = error.message;
			}

			// MX Record Check- -- - - - -
			const mxCheck = new Promise((resolve, reject) => {
				dns.resolveMx(recipient.split('@')[1], (error, addresses) => {
					if (error || addresses.length === 0) {
						reject('No MX records found');
					} else {
						addresses.sort((a, b) => a.priority - b.priority);
						resolve(addresses);
					}
				});
			});

			try {
				addresses = await awaitdelay(mxCheck, { timeout: 5000 });
				if (addresses && addresses.length > 0) {
					firstAddress = addresses[0].exchange;
				}
			} catch (error) {
				// onsole.log(error)
				mxCheckError = error.message;
			}


			// Valid Check- -- - - - -
			if (checkValid && firstAddress) {
				let username = recipient.split('@')[0];
				let domain = recipient.split('@')[1];
				let isGoogleMailServer = firstAddress.includes('google');
				let randomHost = ['yahoo.com', 'hotmail.com', 'outlook.com'][Math.floor(Math.random() * 3)];
				let sender_address = isGoogleMailServer ? `${username}@${randomHost}` : `${username}@gmail.com`;
				if (sender) {
					sender_address = sender;
				}

				const validCheck =  new Promise((resolve, reject) => {
					let emailExists = null;
					const socket = net.createConnection(25, firstAddress);
					socket.setTimeout(10000);

					const EOL = '\r\n';
					let randomIndex = Math.floor(Math.random() * hostnames.length);
					let randomHostname = hostnames[randomIndex];
					sendAndLog(socket, `HELO ${randomHostname}${EOL}`);
					sendAndLog(socket, `MAIL FROM: <${sender_address}>${EOL}`);
					sendAndLog(socket, `RCPT TO: <${recipient}>${EOL}`);
					socket.write(`QUIT${EOL}`);


					let buffer = '';
					let responses = [];

					socket.on('data', data => {
						buffer += data.toString();
						let eolIndex;

						while ((eolIndex = buffer.indexOf('\r\n')) >= 0) {
							let response = buffer.substring(0, eolIndex).trim();
							responses.push(response);
							buffer = buffer.substring(eolIndex + 2);

							if (response.startsWith('550') || response.startsWith('552') || response.startsWith('554')) {
								if(response.toLowerCase().includes(`mailbox not found`) || response.toLowerCase().includes(`does not exist`) || response.toLowerCase().includes(`temporary server error. please try again later`) || response.toLowerCase().includes(`mailbox unavailable`) || response.toLowerCase().includes(`no valid recipients`) ){
									emailExists = false;
								}
							}
						}
					})
					

					socket.on('timeout', () => {
						socket.end();
						if (!socket.destroyed) {
							socket.destroy();
						}
						reject('SMTP response timed out');
					});

					// Then in your 'end' event
					socket.on('end', () => {
						if (emailExists === false) {
							resolve({ valid: false, message: responses[responses.length - 1] });
						} else {
							resolve({ valid: true, message: responses[responses.length - 1] });
						}
						if (!socket.destroyed) {
							socket.destroy();
						}
					});

					socket.on('close', () => {
						if (!socket.destroyed) {
							socket.destroy();
						}
					});
				});



				try {
					validationResults = await awaitdelay(validCheck, { timeout: 15000 });
				} catch (error) {
					validCheckError = error.message;
				}
			}

			timeoutError = formatCheckError || mxCheckError || validCheckError;

			return {
				apiError: false,
				timeoutError: timeoutError,
				formatCheckError: formatCheckError,
				mxCheckError: mxCheckError,
				validCheckError: validCheckError,
				addresses: addresses,
				firstAddress: firstAddress,
				validationResults: validationResults,
			};
		} catch (error) {
			return {
				error: 'Internal Server Error',
				apiError: true,
				timeoutError: timeoutError,
				formatCheckError: formatCheckError,
				mxCheckError: mxCheckError,
				validCheckError: validCheckError,
				addresses: addresses,
				firstAddress: firstAddress,
				validationResults: validationResults,
			};
		}
	}
};