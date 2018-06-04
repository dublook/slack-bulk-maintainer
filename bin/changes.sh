echo $1
if type jq >/dev/null 2>&1; then
  cat $1 | jq 'map(select(.updateQuery.skipCallApi == false)) | map(.notification.request.attachments) | flatten | map(select(.color=="#81C784")) | map(.fields[0]) | map(.title + ": " + .value)'
else
  echo "Please install jq (See https://stedolan.github.io/jq/ for details)"
fi
