path="../friendup/build/services/Hello-server"
mkdir $path
#rsyncs root directory is current working directory, hence the omnious looking / before .git*. :justRsyncThings:
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/.example.update_to_fup.sh' \
	. $path
