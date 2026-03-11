FROM outmateai/outmate:1.0-alpha

CMD ["python", "-m", "outmate", "run", "--host", "0.0.0.0", "--port", "7860"]
