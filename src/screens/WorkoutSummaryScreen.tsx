import React from 'react';
import { SafeAreaView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { WorkoutSummaryView } from '../components/WorkoutSummaryView';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutSummary'>;

export const WorkoutSummaryScreen: React.FC<Props> = ({ route, navigation }) => {
    const { date, workoutId, startTime } = route.params;

    React.useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Summary'
        });
    }, [navigation]);

    const handleFinish = () => {
        navigation.navigate('Home', { date, activeTab: 'workout' });
    };

    return (
        <SafeAreaView style={styles.container}>
            <WorkoutSummaryView
                date={date}
                workoutId={workoutId}
                startTime={startTime}
                onFinish={handleFinish}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
});
