#!/usr/bin/env bash

appPath="$1"
echo "$appPath"
IN=0
OUT=0

function getSize() {
	FILE=$1
	DURES=$(du -b "$FILE")
	tmp=${DURES//[^0-9]/}
	echo $tmp
}

function minifyMaybe() {
	FILE=$1
	f=${FILE##*/}
	echo "FILE: $f"
	if ! [ -f "$FILE" ]; then
		echo "not a file $FILE"
		return 1
	fi
	
	before=$(getSize $FILE)
	IN="$(( $IN + $before ))"
	google-closure-compiler --js $FILE --js_output_file "$FILE.mini"
	mv "$FILE.mini" $FILE
	after=$(getSize $FILE)
	OUT="$(( $OUT + $after ))"
}

function iterate() {
	DIR=$1
	d=${DIR#*FriendChat?}
	echo "DIR: $d"
	for ITEM in $DIR/* ; do
		if [ -d "$ITEM" ]; then
			iterate $ITEM
		else
			minifyMaybe $ITEM
		fi
	done;
}

iterate $appPath/"api"
iterate $appPath/"scripts"

IN_KB=$(( $IN / 1024 ))
OUT_KB=$(( $OUT / 1024 ))
REDUCED=$(( 100 * $OUT / $IN ))

echo "--- Minifying results:"
echo "before:     $IN_KB KB"
echo "after:      $OUT_KB KB"
echo "reduced to: $REDUCED%"
