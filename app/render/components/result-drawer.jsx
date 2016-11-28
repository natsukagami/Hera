var { ipcRenderer } = window.require('electron');
import React from 'react';
import Drawer from 'material-ui/Drawer';
import { List, ListItem } from 'material-ui/List';
import Subheader from 'material-ui/Subheader';
import IconAccepted from 'material-ui/svg-icons/navigation/check';
import IconPartial from 'material-ui/svg-icons/navigation/more-horiz';
import IconNoScore from 'material-ui/svg-icons/navigation/close';
import { green500, red500, yellow500 } from 'material-ui/styles/colors';
import Avatar from 'material-ui/Avatar';
import CircularProgress from 'material-ui/CircularProgress';

var ResultItem = React.createClass({
	render() {
		var leftAvatar, propColor;
		if (this.props.percent === 0) {
			propColor = red500;
			leftAvatar = <IconNoScore/>;
		}
		else if (this.props.percent < 1) {
			propColor = yellow500;
			leftAvatar = <IconPartial/>;
		}
		else {
			propColor = green500;
			leftAvatar = <IconAccepted/>;
		}
		return (<ListItem
					leftAvatar={<Avatar icon={leftAvatar} backgroundColor={propColor}/>}
					rightIcon={<CircularProgress
									mode={'determinate'}
									min={0}
									max={1}
									value={Math.max(this.props.percent, 0.01)}
									size={0.5}
									color={propColor}
									style={{paddingRight: '20px', bottom: 20}}
								/>}
					primaryText={<div>{this.props.name}: <b>{this.props.result}</b></div>}
					secondaryText={<div>
									Thời gian chạy: <b>
										{Math.round(this.props.time * 1000) / 1000}s
									</b> | Bộ nhớ: <b>
										{this.props.memory}
									</b> KBs
								</div>}
				/>);
	}
});

var ResultDrawer = React.createClass({
	getInitialState() {
		var inst = this; // instance
		ipcRenderer.on('result-drawer', function(event, data) {
			var list = Object.keys(data).map(function(id) { return data[id]; });
			inst.setState({
				tests: list,
				open: true
			});
		});
		return {
			tests: [],
			open: false
		};
	},
	handleChange(open) {
		this.setState({open: open});
	},
	render() {
		var inst = this;
		var items = this.state.tests.map(function(test) {
			return (<ResultItem
						name={test.name}
						percent={test.score / test.maxScore}
						time={test.time}
						memory={test.memory}
						result={test.result}
					/>);
		});
		return (<Drawer
					docked={false}
					width={700}
					open={this.state.open}
					onRequestChange={this.handleChange}
				>
					<List>
						<Subheader inset={true}>Kết quả chấm</Subheader>
						{items}
					</List>
				</Drawer>);
	}
});

export default ResultDrawer;
