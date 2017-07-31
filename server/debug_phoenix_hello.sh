#!/bin/bash
# This script enables debugging the node process, IF UNSURE; DO NOT USE

timestamp() {
	date
}

if pgrep "hello.js" > /dev/null
then
	echo "Hello server is running"
else
	echo "Starting Hello server"
	until node --debug hello.js; do
		echo "Hello server halted: " $( timestamp ) " - exitcode: $?. Respawning in 1 sec" >> restart.log
		sleep 1
	done >> error.log 2>&1
fi
