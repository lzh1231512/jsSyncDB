#!/bin/bash
yum remove docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-selinux docker-engine-selinux docker-engine
yum install -y yum-utils device-mapper-persistent-data lvm2
yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
yum makecache fast
yum -y install docker-ce
mkdir /etc/docker
echo -e "{ \n\
    \"registry-mirrors\": [\"https://registry.docker-cn.com\",\"http://hub-mirror.c.163.com\"] \n\
}" > /etc/docker/daemon.json
systemctl start docker
ADDR="lzhsb.cc"
TMPSTR=`ping ${ADDR} -c 1 | sed '1{s/[^(]*(//;s/).*//;q}'`
echo ${TMPSTR}
docker run -d --log-opt max-size=10m --log-opt max-file=3 --name=ipp_7981 -e SERVERIP=${TMPSTR} -e SERVERPORT=7980 -e HOSTPORT=7981 --cap-add=NET_ADMIN --cap-add=NET_RAW -p 7981:7981 soarinferret/iptablesproxy
docker run --log-opt max-size=10m --log-opt max-file=3 -dt --name ss -p 7980:7980 --restart=always mritd/shadowsocks -s "-s 0.0.0.0 -p 7980 -m aes-256-cfb -k YjM1MDNkNj -u" 

