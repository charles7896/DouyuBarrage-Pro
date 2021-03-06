import React, { Component } from 'react';
import {
  Statistic,
  Row,
  Col,
  Card,
  Tag,
  PageHeader,
  Typography,
  Divider,
  Spin,
  Modal,
  Input,
  Button,
  message
} from 'antd';
import { getRoomDyInfo } from '../network/http';
import getWebSocketClient from '../network/websocket/WebSocketClient';

interface IStatistic {
  title: string;
  value: number | string;
}

interface IRoomDyInfo {
  avatarUrl: string;
  owner: string;
  roomTitle: string;
  cateName: string;
  isOnline: boolean;
  hot?: number;
  startTime?: string;
}

interface IState {
  statData: Array<IStatistic>;
  roomDyInfo: IRoomDyInfo;
  noThisRoom: boolean;
  alreadyAddSameRoom: boolean;
  isStartCrawling: boolean;
  isAddedRoomSuccess: boolean;
}

export default class BasicStat extends Component<{}, IState> {
  constructor(props: any) {
    super(props);

    this.state = {
      statData: [],
      roomDyInfo: {
        avatarUrl: '',
        roomTitle: '',
        owner: '',
        cateName: '',
        isOnline: false
      },
      noThisRoom: false,
      alreadyAddSameRoom: false,
      isStartCrawling: false,
      isAddedRoomSuccess: false
    };
  }

  getRoomDyInfo = () => {
    getRoomDyInfo()
      .then(res => {
        if (res.data.error === 0) {
          const data: any = res.data.data;
          const roomDyInfo: IRoomDyInfo = {
            avatarUrl: data.avatar,
            roomTitle: data.room_name,
            owner: data.owner_name,
            cateName: data.cate_name,
            startTime: data.start_time,
            hot: data.hn,
            isOnline: data.room_status === '1'
          };

          this.setState({ roomDyInfo });
        }
      })
      .catch(err => {
        if (err.response.status === 404) {
          this.setState({ noThisRoom: true });
        } else if (err.response.status === 500) {
          message.error('无互联网连接，无法获取房间信息！');
        }
      });

    console.log('get room dy info');
  };

  subscribeEvents = () => {
    const ws = getWebSocketClient();
    ws.addSubscriber('add_room_success', () => {
      this.setState({ isAddedRoomSuccess: true });
    });
    ws.addSubscriber('add_room_failed', (data: any) => {
      message.error(data);
      this.setState({ alreadyAddSameRoom: true });
    });

    ws.addSubscriber('crawl_basic_stat', (data: any) => {
      this.setState({ statData: JSON.parse(data) });
    });

    ws.addSubscriber('start_crawl_success', () => {
      message.success('开始抓取！');
      this.setState({ isStartCrawling: true });
    });
    ws.addSubscriber('start_crawl_failed', (data: any) => {
      message.error(data);
    });

    ws.addSubscriber('crawl_failed', (data: any) => {
      message.error(data);
      this.setState({ isStartCrawling: false });
    });

    ws.addSubscriber('stop_crawl_success', () => {
      message.success('已停止抓取！');
      this.setState({ isStartCrawling: false });
    });
    ws.addSubscriber('stop_crawl_failed', (data: any) => {
      message.error(data);
    });

    ws.addConnectSuccessHook(() => this.getRoomDyInfo());
    ws.addConnectErrorHook(() => this.setState({ isAddedRoomSuccess: false }));
  };

  componentDidMount() {
    this.subscribeEvents();

    this.getRoomDyInfo();
  }

  renderStatistic = () => {
    return this.state.statData.length !== 0 ? (
      <Row gutter={[16, 16]}>
        {this.state.statData.map((item, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic title={item.title} value={item.value} />
            </Card>
          </Col>
        ))}
      </Row>
    ) : (
      <Spin />
    );
  };

  renderRoomDyInfo = () => {
    const {
      owner,
      roomTitle,
      avatarUrl,
      cateName,
      isOnline,
      hot,
      startTime
    } = this.state.roomDyInfo;
    return roomTitle !== '' ? (
      <PageHeader
        title={owner}
        subTitle={roomTitle}
        avatar={{ src: avatarUrl }}
        tags={[
          <Tag color="orange" key={0}>
            {isOnline ? '正在直播' : '未开播'}
          </Tag>,
          <Tag color="orange" key={1}>
            {cateName}
          </Tag>
        ].concat(
          isOnline
            ? [
                <Tag color="red" key={2}>{`热度：${hot}`}</Tag>,
                <Tag color="orange" key={3}>{`开播时间：${startTime}`}</Tag>
              ]
            : [<Tag color="orange" key={2}>{`上次开播时间：${startTime}`}</Tag>]
        )}
        extra={[
          <Button
            key={0}
            type="primary"
            disabled={!this.state.isAddedRoomSuccess || this.state.isStartCrawling}
            onClick={() => getWebSocketClient().emitEvent('start_crawl', '')}
          >
            开始抓取
          </Button>,
          <Button
            key={1}
            type="primary"
            disabled={!this.state.isStartCrawling}
            onClick={() => getWebSocketClient().emitEvent('stop_crawl', '')}
          >
            停止抓取
          </Button>
        ]}
      />
    ) : (
      <Spin />
    );
  };

  // if this room is not existed in Douyu
  // the modal will appear to force user to re-select room
  renderModal = (visible: boolean, title: string, info: string) => {
    return (
      <Modal visible={visible} closable={false} footer={null} title={title}>
        <p>{info}</p>
        <Input.Search
          placeholder="房间号"
          enterButton
          style={{ width: '300px' }}
          onSearch={value => (window.location.href = `http://localhost:3000?roomid=${value}`)}
        />
      </Modal>
    );
  };

  render() {
    return (
      <div>
        {this.renderModal(
          this.state.noThisRoom,
          '斗鱼无此房间！',
          '请检查房间号，输入后回车，跳转到正确的房间'
        )}
        {this.renderModal(
          this.state.alreadyAddSameRoom,
          '你已经打开了此房间的管理中心！',
          '输入新的房间号回车，跳转到新的房间'
        )}

        <Typography.Title level={4}>主播基本情况</Typography.Title>
        {this.renderRoomDyInfo()}
        <Divider />

        <Typography.Title level={4}>弹幕基本情况</Typography.Title>
        {this.renderStatistic()}
      </div>
    );
  }
}
