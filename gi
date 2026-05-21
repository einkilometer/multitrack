! test bak && mkdir bak
! test $2 && cp $1 bak/$1-$(date "+%Y%m%d-%H%M") 
test $2 && mv $1 $1-$(date "+%Y%m%d-%H%M")
nano $1
echo
echo going to push
sleep 3
git add $1
git commit -m $(date "+%Y%m%d-%H%M")
git push origin main


