git stash
git pull --rebase origin main
echo -------------------------------------------------
echo you wanted the online stuff
echo press ^c to prevent that your last stash pop s in
echo
sleep 1
echo -------------------------------------------------
echo
git stash list
sleep 4
echo
echo -------------------------------------------------
git stash pop
