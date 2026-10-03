fetch("http://127.0.0.1:3000/api/health")
  .then((response) => {
    if (response.ok) window.location.replace("http://127.0.0.1:3000");
  })
  .catch(() => undefined);
