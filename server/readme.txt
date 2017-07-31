How to Hello server

0.a: This is an ubuntu server.
0.b: mySQL is installed.

You can copy this folder to the appropriate place in the the friendup filestructure
by running update_to_fup.sh, after adjusting the path defined in the script as necessary.

1: copy example.config.js to config.js

2: set database host, port, user, pass and name in config.js

3: Feel free to set other relevant values in config.js while you are in there,
	but it is not critical to the install process.

4: TLS : in config, set shared.tls to true and set the proper paths in server.tls.
	WARNING : If you wish to genereate a selfsigned certificate, you can use
	scripts/self-TLS-gen.sh. Make sure to set the last argument to the proper domain first,
	but even then it will probably cause more problems than its worth,
	as browsers might simply block the connection if they find the cert not to their liking.
	PRO-TIP : use www.letsencrypt.com for free, no-hassle certs.

5: run as superuser:
		> bash install.sh
	bash, not sh
	This will check for node and npm, install nodejs packages and set up the database

6: Install the TURN server by following instructions in TURN/readme.txt

7: starting the server:
		> phoenix_hello.sh
	will start, and respawn the server if it crashes.
	It also writes to error.log and restart.log.
	To stop it, kill the phoenix_hello.sh process first, then the server.
	OR
	start the server directly with
		> node hello.js
	
	For starting from terminal and leaving it in the background, so it doesnt stop when
	the terminal is closed, use 'nohup <command> &' and hit enter a few times.
	feks:
		> nohup sh phoenix_hello.sh &
