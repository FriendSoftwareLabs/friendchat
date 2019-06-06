#!/usr/bin/env bash

echo "write VERSION info"
appPath="$1"
echo "$appPath"
if [ -z "$appPath" ]; then
    echo "version.sh - missing app path"
    exit 1
fi

if [ ! -d "$appPath" ]; then
    echo "version.sh - could not find app directory"
    exit 1
fi

# APP VERSION
version=$(grep Version < Config.conf )
vRX="Version\"\s*:\s*\"([0-9\.]*)\""
if [[ $version =~ $vRX ]]
then
    version="${BASH_REMATCH[1]}"
else
    version="unknown"
fi

# GIT BRANCH
branch=$(git status | grep "On branch")
if [ -z "$branch" ]; then
    branch="unknwon"
else
    IFS=' ' read -r -a array <<< "$branch"
    branch=${array[-1]}
fi

#GIT COMMIT
hashRX="commit\s([0-9a-zA-Z]*)"
commit=$(git log | head -n 1)

if [[ $commit =~ $hashRX ]]
then
    commit="${BASH_REMATCH[1]}"
else
    commit="unknown"
fi

#GIT DATE
dateRX="Date:(.*)"
date=$(git log | grep 'Date:' | head -n 1)
if [[ $date =~ $dateRX ]]
then
    date="${BASH_REMATCH[1]}"
else
    date=""
fi

echo "version:" $version
echo "branch:" $branch
echo "commit:" $commit
echo "date:" $date

# WRITE TO local.config.js
json="{\
\"version\":\"$version\",\
\"branch\":\"$branch\",\
\"commit\":\"$commit\",\
\"date\":\"$date\"\
}"
#echo $json
confPath="$appPath/local.config.js"
confRX="about\s*:.*$"
confReplace="about : $json,"
sed -i -r -e "s|$confRX|$confReplace|g" $confPath
